# Generation history persists app-side as an append-only JSONL file

History lives at `history.jsonl` in the same `app_data_dir` as `voice-profiles.json` (ADR-0004: core owns no persistence, so this is entirely an app-side concern, mirroring the existing `persistence.rs` pattern of raw-bytes Rust commands with no schema knowledge on that side). Unlike `voice-profiles.json`, it is **not** a single JSON array rewritten whole on every change — it's JSON Lines, one record per line, appended to on every generation. The map already decided history is unbounded with no auto-pruning, so the frequent-case cost matters: a generation happens on every use of the app's primary action, while delete/clear-all are occasional manual cleanup. Optimizing the common case for a cheap append (and the crash-safety that comes with never rewriting already-written lines) is worth the small added complexity of a second parsing path alongside the existing whole-file JSON one. Delete (single entry) and clear-all still require reading and rewriting the file, same as the profiles pattern — there's no way around that for a flat file, and it's the operation that can afford it.

Each line is:

```ts
{
  id: string;          // uuid
  createdAt: string;   // ISO timestamp
  profileId: string;
  profileName: string; // denormalized snapshot, not a live join
  vendor: AiVendor;     // "openai" | "anthropic", per ADR-0005 — which backend actually ran this
  mode: "rewrite" | "generate";
  inputText: string;
  context?: string;
  options?: GenerationOptions; // the resolved options actually sent (ADR-0007/#58's decision)
  variants: string[];
}
```

`profileId` is paired with a denormalized `profileName` rather than either a bare id (which live-joins against the current profiles list and would show as "deleted profile" once a custom profile is edited or removed) or a full `VoiceProfile` snapshot (unnecessary weight — description/examples/constraints aren't needed to show what happened in a history list). History's job is to show what actually ran at the time, independent of later profile edits, so a name-only snapshot is the right amount of denormalization. `vendor` is included even though no ticket explicitly asked for it — it's already first-class app state (ADR-0005) available for free at generation time, and "which backend produced this" is an obvious thing to want later without having to guess from context.
