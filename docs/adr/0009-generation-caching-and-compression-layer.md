# A provider-side caching/compression layer cuts redundant `generate()` spend, measured against a real baseline

This closes the wayfinder map ["Caching layer for voicecraft's generate() pipeline" (#85)](https://github.com/mellowrush/voicecraft/issues/85). Scope is runtime-only — the app's own `generate()` calls to OpenAI/Anthropic, not dev-tooling around building voicecraft itself (rtk/headroom filter shell output for coding agents; there's no equivalent hook point for an app's HTTP calls, and only the underlying techniques transfer). Five mechanisms ship, each measured individually and cumulatively against a real before/after baseline rather than a projected one, because none of them are worth building blind: a duplicate-request cache, a static-content compression pass, client-side call throttling, a savings UI, and — after research — a decision to leave vendor-native prompt caching alone for now.

## Measurement comes first (#94)

Every mechanism below is judged by extending `HistoryEntry`/`history.jsonl` (ADR-0008) with per-call metadata, logged unconditionally on every real generation — not a toggled "baseline capture" window, since the data is free on every API response and the pre-optimization period is itself the baseline. Usage is captured in Rust (`call_provider`, `provider.rs`) from the vendor response's own usage block and handed to the TS `tauriProvider` wrapper for logging; it never enters `Engine`/`Provider` (ADR-0002's flat `prompt: string → text` contract stays untouched — usage rides alongside the call, not inside it). Dollar cost is computed at display time via a small pricing table, not stored, so old entries don't go stale when vendor pricing changes.

```ts
type HistoryEntry = {
  // ...existing ADR-0008 fields unchanged...
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number };
  dedupeHit: boolean;
  compressed: boolean;
  savedUsage?: { inputTokens: number; outputTokens: number }; // only set when dedupeHit
};
```

`dedupeHit` and `compressed` are independent flags, not one enum — a call can be both at once. `savedUsage` (surfaced while prototyping #90) holds the *original* real call's usage at the moment of a dedupe hit, so the savings UI can compute "tokens saved" from `history.jsonl` alone even after the underlying cache entry has been evicted.

## Duplicate-request cache (#86, #87)

`runAction` (`useVoicecraftApp.ts`) is the only code path that calls `engine.generate()` from the main window, so it's the only place a cache check is needed. There's no keystroke-triggered regenerate and no undo/redo anywhere in the app (both were wrong assumptions during charting) — the real repeat case is simply the user re-invoking `runAction` with compose state unchanged, whether after an error or after loading a past entry via `rerunHistoryEntry` without editing it.

**Key**: a content-hash of `{profile: full content, not just id; text; mode; context; options: the resolved options actually sent; vendor; model}` — so an edited profile, a different vendor, or a model swap naturally busts stale entries with no manual invalidation.

**On a hit**: skip `engine.generate()` entirely (no Provider/API call), write a `HistoryEntry` as normal but with `dedupeHit: true`, `usage: {inputTokens: 0, outputTokens: 0}`, and `savedUsage` copied from the cache entry, reusing its cached `variants`.

**Streaming**: not applicable today — `runAction` hardcodes `{ stream: false }`, so the app never exercises `Engine`'s streaming path. Revisit if that changes.

**Storage**: a whole-file JSON object, `generation-cache.json` in the same `app_data_dir` as `voice-profiles.json`/`history.jsonl`, keyed by the content-hash — `{ "<hash>": { variants: string[], usage: {...}, cachedAt: string, lastAccessedAt: string } }`. Not `history.jsonl`'s append-only convention: LRU eviction needs to bump `lastAccessedAt` on every hit, a mutation an append log can't do without growing unboundedly from reads alone. New Rust commands `read_generation_cache_file`/`write_generation_cache_file` mirror `persistence.rs` exactly — raw string I/O only, no schema knowledge in Rust (ADR-0004: core/native layers own no persisted schema, TS owns shape and eviction logic).

**Eviction**: TTL is checked at load time, filtering expired entries before building the in-memory map; the LRU cap is enforced only at insert time, evicting least-recently-accessed entries down to the cap when a fresh miss would exceed it. Exact TTL duration and cap size are deferred as an implementation detail — the policy shape is fixed, the numbers aren't, until real usage data exists to tune them.

## Client-side throttling (#88)

Turned out not to be a debounce problem. `MainPanel`'s Generate button is already guarded (`disabled={isLoading || ...}`), and there's no keystroke-triggered auto-regenerate anywhere to debounce. The actual gap was `HudWindow.tsx`'s `hotkey://selection` listener, which fired a fresh `engine.generate()` on every event with no check against its own in-flight state — a rapid double-tap of the global hotkey could start two concurrent API calls. Fixed with a simple guard (`if (state?.status === "loading") return;`) at the top of the handler; the HUD's existing loading UI already communicates "busy," so no new UI was needed.

## Static-content compression (#93)

Only `VoiceProfile.description` (unbounded freeform prose) is a compression candidate — `constraints`, `examples`, `tags`, and `name` are never touched, since their exact wording is load-bearing (a "never use profanity" constraint or a few-shot example loses its purpose paraphrased). Compression is a deterministic heuristic (collapse redundant whitespace/filler, hard-cap at a generous length) — not an LLM summarization pass, which would add its own cost/latency and risks subtly rewording voice-defining language. It runs once, at profile save/edit time (`saveProfile`), not per `generate()` call, producing a precomputed value stored on the profile:

```ts
// packages/core/src/voice-profile.ts — additive, non-breaking
descriptionCompressed?: string;
```

`buildPrompt()` prefers `descriptionCompressed` when present, falling back to `description` otherwise. This is complementary to vendor caching (below), not redundant — compression reduces the byte count of every call including the first, uncached one; caching only pays off on repeats against the same prefix.

## Vendor-native prompt caching: dormant, not built (#89)

Researched rather than built — findings at [`docs/research/vendor-prompt-caching.md`](https://github.com/mellowrush/voicecraft/blob/main/docs/research/vendor-prompt-caching.md). `buildPrompt()` already emits the Voice Profile's static content first, before any per-call text — a genuine stable prefix in principle — but neither vendor benefits under the app's current flat-string request today, for different reasons:

- **Anthropic** requires explicit `cache_control` on structured content blocks; nothing is cached without it, and there's no automatic path. Attaching it means converting `content` from a plain string into content blocks — exactly the shape ADR-0002 rules out for the Provider boundary. No in-scope path unlocks this.
- **OpenAI** is fully automatic and needs zero code changes — it matches on the full rendered prefix regardless of message structure — but requires ≥2,048 stable-prefix tokens for `gpt-4o-mini`, and typical Voice Profile content (name, description, tags, constraints, examples) is unlikely to reach that today.

Nothing to build here. If Voice Profile content grows past that threshold, OpenAI's caching activates on its own with no further work — worth re-checking if profile-authoring patterns change, but not actionable now.

## Savings UI (#90, #91)

A third tab, `"savings"`, alongside `MainPanel`'s existing `"compose"`/`"history"` tabs — not `SettingsModal` (config surface, no tab infra) or `HudWindow` (ephemeral, wrong lifetime for a persistent view). Three visual variants were prototyped at [`696b927`](https://github.com/mellowrush/voicecraft/commit/696b927); **Variant C — a minimal, receipt-style ledger** was picked: one large total (tokens + $ saved), thin dashed rows below for dedupe hit rate, dedupe count, a compression estimate (shown as a cohort-level before/after average — compression isn't attributable per-call — labelled as an estimate), and vendor caching shown as an explicitly dormant state per the research above. It reads `history.jsonl` directly using the `usage`/`dedupeHit`/`savedUsage` fields from the measurement schema — no join against `generation-cache.json`, so numbers survive cache eviction.

A per-result "⚡ cached" badge (mint-pulse pill, `MainPanel`'s toolbar-right, next to the Result/Diff toggle) indicates a whole result came from the dedupe cache — one badge per result, not per variant, since a hit returns the whole cached `variants` array together. Prototyped at [`4702116`](https://github.com/mellowrush/voicecraft/commit/4702116); needs a new `dedupeHit: boolean` field on `RunStatus`'s `"success"` case. `HudWindow` doesn't share the dedupe cache (its hotkey flow bypasses `runAction` entirely), so it has nothing to badge — whether that should change is open, not decided.

## Out of scope

- Anthropic explicit `cache_control` prompt caching — blocked by ADR-0002 (Provider receives a flat string, not structured content blocks). Revisit only if ADR-0002 itself is redrawn.
- Dev-tool wrapping (rtk/headroom around Claude Code/Codex, for building voicecraft itself) — not a runtime-pipeline concern.

## Open, not yet actionable

- Exact TTL/LRU cap numbers for the duplicate-request cache — policy shape fixed, numbers wait on real usage data.
- Whether cache/savings stats should ever feed a broader telemetry system — none exists today.
- Whether Voice Profile content is likely to grow past OpenAI's ~2,048-token caching threshold.
- Whether `HudWindow`'s hotkey flow should ever share the dedupe cache.
