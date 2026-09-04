# Research: vendor native prompt-caching applicability

Research for #89, part of the caching/cost-reduction wayfinder map (#85). Question: does
voicecraft's current request shape — one flat prompt string, sent as a single user message, with
no code changes — benefit from either vendor's native prompt caching today?

## Current request shape (for reference)

`packages/app/src-tauri/src/commands/provider.rs`:

- OpenAI: `POST https://api.openai.com/v1/chat/completions`, model `gpt-4o-mini` (`OPENAI_MODEL`),
  body `{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}]}`.
- Anthropic: `POST https://api.anthropic.com/v1/messages`, model `claude-haiku-4-5-20251001`
  (`ANTHROPIC_MODEL`), body
  `{"model": ..., "max_tokens": 4096, "messages": [{"role": "user", "content": prompt}]}`.

`prompt` is one flat string from `packages/core/src/prompt.ts`'s `buildPrompt()`. Sections 1-5
(voice name, `profile.description`, tags, constraints, examples) are a stable prefix across
repeated calls to the same Voice Profile; sections 6-9 (per-call options, context, the actual
input text, variant-count instruction) vary per call and sit after the stable part.

**Out of scope, confirmed only for the record:** Anthropic's explicit `cache_control` mechanism
requires the cacheable text to be a content block (`system` as an array of blocks, or a `messages[].content`
array of blocks) carrying `cache_control: {"type": "ephemeral"}` — a plain string `content` value
has nowhere to attach a breakpoint. Restructuring `{"role": "user", "content": prompt}` into
`content: [{"type": "text", "text": prefix, "cache_control": {...}}, {"type": "text", "text": rest}]`
is exactly the "structured content blocks" shape ADR-0002 rules out for the Provider boundary, so
this path is not investigated further here.
(https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

## 1. OpenAI (`gpt-4o-mini` via `chat.completions`)

- **Automatic, zero request changes.** "Prompt caching is enabled by default for supported OpenAI
  models" — no request parameter, header, or opt-in is required; `gpt-4o-mini` is a supported
  ("earlier") model. (https://developers.openai.com/api/docs/guides/prompt-caching)
- **Minimum length: 2,048 tokens** of visible input for earlier models like `gpt-4o-mini` (the doc
  notes occasional hits below that threshold, but 2,048 is the stated floor). Newer/larger models
  (GPT-5.6+ tier) use a different, lower structure not relevant to `gpt-4o-mini`.
  (https://developers.openai.com/api/docs/guides/prompt-caching)
- **Structure requirement: none beyond exact-prefix token match.** Caching operates on "the
  model's full rendered context" (whatever system/developer content, messages, and tools render
  to, in sequence) and matches on "the entire rendered prefix" being byte/token-identical to a
  previously-cached request. For earlier models breakpoints are placed automatically at
  model-dependent intervals — there is no manual placement, no requirement for multiple messages,
  and no requirement for a `system` field. A single flat string as the sole `user` message content
  qualifies exactly as well as a multi-message request: what matters is whether the rendered token
  sequence up to some point matches a prior request's, not the shape of the request that produced
  it. (https://developers.openai.com/api/docs/guides/prompt-caching)
- **TTL / eviction:** two retention tiers exist for earlier models. `in_memory` entries "typically
  remain active for around 5 to 10 minutes of inactivity, up to one hour"; `24h` entries "typically
  keep entries available for around 30 minutes and can retain them for up to 24 hours." Default
  tier depends on org data-retention settings (non-ZDR orgs default to `24h`, ZDR orgs default to
  `in_memory`). (https://developers.openai.com/api/docs/guides/prompt-caching)
- **Pricing:** for `gpt-4o-mini`, standard input is $0.15/1M tokens, cached input is $0.075/1M
  tokens, output is $0.60/1M tokens — a flat **50% discount** on cached input tokens.
  (https://developers.openai.com/api/docs/pricing)
- **Usage field:** the Chat Completions response's `usage` object carries
  `usage.prompt_tokens_details.cached_tokens` — "Cached tokens present in the prompt," a `number`,
  alongside sibling fields (`audio_tokens`, `cache_write_tokens`, `image_tokens`, `text_tokens`) in
  the same `prompt_tokens_details` object. (https://developers.openai.com/api/docs/api-reference/chat/object)

## 2. Anthropic (`claude-haiku-4-5-20251001` via `messages`)

- **Explicit opt-in strictly required — nothing is cached by default.** "Without a `cache_control`
  field somewhere in the request, no caching occurs." The two supported forms are a single
  top-level `cache_control: {"type": "ephemeral"}` (auto-manages where the breakpoint sits, moving
  it forward as the conversation grows) or manual `cache_control` on individual content blocks —
  both require the request body to carry the field explicitly; there is no automatic, zero-change
  caching path analogous to OpenAI's. (https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- **Minimum cacheable prefix for Haiku models: 4,096 tokens.** This is Anthropic's *highest*
  minimum tier among current models — compare 512 tokens (Opus 5/Fable 5 tier), 1,024 tokens
  (Sonnet 5/4.6/4.5 tier), 2,048 tokens (Opus 4.7, Haiku 3.5), versus **4,096 tokens for Opus 4.6,
  Opus 4.5, and Haiku 4.5** (the model this app uses, `claude-haiku-4-5-20251001`). Prompts shorter
  than the minimum are processed without error, just without caching — confirmed by
  `cache_creation_input_tokens`/`cache_read_input_tokens` both reading 0.
  (https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- **TTL and pricing:** two TTL options — 5-minute (default, refreshed at no extra cost on each use)
  and 1-hour (opt-in via `"ttl": "1h"`, additional cost). Relative to base input token price: 5-min
  cache writes cost **1.25x**, 1-hour cache writes cost **2x**, and cache reads cost **0.1x** base
  input price (Haiku 4.5 base input is $1/MTok, so cache reads are $0.10/MTok — a 90% discount on a
  hit, but a 25%-100% premium on the write that has to happen first).
  (https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- **Usage fields:** the response's `usage` object (or `message_start` event when streaming)
  includes `cache_creation_input_tokens` (tokens written to a new cache entry) and
  `cache_read_input_tokens` (tokens served from an existing cache entry), with plain `input_tokens`
  covering whatever is neither. `total_input_tokens = cache_read_input_tokens +
  cache_creation_input_tokens + input_tokens`. (https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

## 3. Verdict

**No benefit from either vendor today, as-is, with the current single-flat-string request shape —
but for two entirely different reasons, and OpenAI is one code-free config change away from
working while Anthropic categorically is not without the out-of-scope restructuring.**

- **Anthropic gives no benefit and cannot without a scope change.** Caching is opt-in only —
  nothing is cached without a `cache_control` field in the request — and the only way to attach
  one is to convert `content` from a plain string into an array of content blocks, which is
  precisely the structured-content-block shape ADR-0002 and this research's scope explicitly rule
  out. So today's flat-string, zero-annotation request gets zero Anthropic caching, and no
  in-scope change can turn that on.
- **OpenAI is strictly better positioned, but the current call still gets no benefit today,
  purely on prompt length.** OpenAI's caching needs no `cache_control`, no structured content
  blocks, and no code change at all — a single flat string in one `user` message is exactly what
  the caching mechanism matches against, since it operates on the full rendered request's token
  prefix regardless of message shape. The blocker is the 2,048-token minimum: Voice Profile
  sections 1-5 (`name` + `profile.description` + tags/constraints/examples) would need to render
  to ≥2,048 tokens before any given profile's calls start hitting cache, and typical Voice Profile
  prose (a name, a short description, a handful of tags/constraints/examples) is very unlikely to
  reach that on its own today. If/when profile content grows (e.g. richer few-shot example sets)
  past ~2,048 tokens, OpenAI caching activates automatically with no further work; Anthropic never
  will under the current flat-string contract.
- **Bottom line:** treat this as no near-term win on either vendor under the existing contract.
  If cost reduction on the stable Voice-Profile prefix is wanted sooner, it requires either (a) a
  scope change to ADR-0002 to allow structured content blocks (unlocks Anthropic caching,
  independent of prompt length, given Haiku 4.5's 4,096-token minimum is likely to be a bigger
  practical obstacle than the block-structuring itself), or (b) growing Voice Profile prompt
  content on the OpenAI path past ~2,048 tokens, which needs no scope change at all.

## Sources

- https://developers.openai.com/api/docs/guides/prompt-caching
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/api-reference/chat/object
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
