# Multi-variant parsing: one Provider call, N text variants

Research for #62. Constraint from `docs/adr/0002-provider-is-a-thin-prompt-in-text-out-function.md`:
the `Provider` stays `(prompt) => text/stream`; the Engine builds the prompt and parses the
response, and no vendor-specific structured-output shape can be assumed to look the same on both
vendors from the Engine's point of view.

## 1. What each vendor's docs actually say

### OpenAI

- **Structured Outputs / JSON schema mode** guarantees schema-conformant JSON via constrained
  decoding, for the Responses, Chat Completions, Assistants, Fine-tuning and Batch APIs alike:
  "Structured Outputs is a feature that ensures the model will always generate responses that
  adhere to your supplied JSON Schema" — every documented schema example is a top-level **object**
  (e.g. `{"type": "object", "properties": {...}}`); none of the fetched guide content shows or
  confirms a bare top-level `{"type": "array", "items": {"type": "string"}}` schema as the root.
  (developers.openai.com/api/docs/guides/structured-outputs)
- **Refusals**: a schema-conforming request can still be refused on safety grounds; the response
  then carries a distinct `refusal` field instead of the structured payload, and OpenAI's own
  guidance is to check `item.type == "refusal"` before parsing. Truncation is separately
  detectable via `status === "incomplete"` / `incomplete_details.reason` (e.g. hit `max_tokens`
  before finishing the array). (developers.openai.com/api/docs/guides/structured-outputs)
- **Streaming + Structured Outputs**: the Responses streaming guide documents typed SSE events
  (`response.created`, `response.output_text.delta`, `response.completed`, `error`) and explicitly
  defers "streaming structured output" to the Structured Outputs guide's own streaming section as
  an "advanced use case" rather than describing incremental-array parsing inline.
  (developers.openai.com/api/docs/guides/streaming-responses) Independent reporting on the
  OpenAI Python SDK's stream-accumulation internals confirms the practical pattern: delta events
  carry raw JSON string fragments, the SDK's `ChatCompletionStreamState`/`accumulate_delta` merges
  them into a snapshot, and the fully-parsed object is only emitted once the JSON is complete
  (`content.done`) — i.e. even with SDK help, a JSON array is not usable piece-by-piece as it
  streams; you get "progressively-conforming" partial JSON, not N independently consumable
  variants until the array closes.
- **`n` parameter (legacy Chat Completions)**: `n` requests `n` independent completions for one
  prompt, returned as a `choices` array (each with its own `index`), billed once for prompt tokens
  and per-completion for output tokens. This is the closest thing OpenAI has to "N variants,
  natively" — but it is Chat-Completions-only and has **no Anthropic equivalent**, and it changes
  the Provider's return shape into "already-separated choices" rather than "one text the Engine
  parses," which is the split the ADR asks us to avoid leaking into the Engine.

### Anthropic

- **Structured Outputs** (`output_config.format`, `type: "json_schema"`) is the same idea as
  OpenAI's: "Structured outputs guarantee schema-compliant responses through constrained
  decoding" — "always valid," "no retries needed for schema violations." Every documented example
  again roots the schema at `"type": "object"`; the docs' own JSON Schema-subset limitations list
  (`minItems` support is 0 or 1 only, `additionalProperties` must be `false`) reads as
  object-shaped-response-oriented and does not confirm a bare top-level string array is supported.
  Unsupported schema features fail fast with an HTTP 400 at request time, not silently at
  generation time. (platform.claude.com/docs/en/build-with-claude/structured-outputs)
- **Streaming**: Anthropic's Messages streaming uses typed SSE events per content block. Plain
  text output streams as `text_delta` events (raw string fragments — same "accumulate before
  parsing JSON" situation as OpenAI). Tool-use inputs stream as `input_json_delta` events carrying
  `partial_json` string fragments; the docs are explicit: **"You accumulate the string deltas and
  parse the JSON once you receive a `content_block_stop` event"** — full-buffer-then-parse is the
  documented pattern, not incremental array-element consumption.
  (platform.claude.com/docs/en/build-with-claude/streaming) A Structured-Outputs-with-streaming
  note (surfaced via the Java SDK section of the same feature docs) says the same thing in other
  words: "you need to accumulate the full response before deserializing the JSON... Once
  accumulated, call `MessageAccumulator.message(...)`."
- **Prompt-engineering fallback** (Anthropic's own documented technique, pre-dating and still
  recommended alongside Structured Outputs for "general output consistency or when you need
  flexibility beyond strict JSON schemas"): ask for a fixed, explicit delimiter/tag format — the
  docs' own worked examples use custom XML-ish tags (e.g. `<report>...</report>`,
  `<competitor>...</competitor>`) rather than freeform prose, and note that providing the exact
  template plus 1-2 worked examples is "more effective than abstract instructions." No numeric
  reliability figure is given (none should be expected from a docs page), but the consistent
  advice — pick one fixed, low-collision-probability template and show the model an example of it
  — is the load-bearing guidance from a primary source.
  (platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/increase-consistency)
- **Model/platform restrictions**: Structured Outputs is only available on a specific list of
  current-generation models and is not available on all platforms Anthropic ships to (e.g. only a
  subset of models on Bedrock) — a real compatibility surface to track if adopted.

## 2. Delimiter reliability and collision risk (synthesis, not a vendor-quantified guarantee)

Neither vendor publishes a hit-rate for plain-text delimiter compliance — it's inherently a
prompting technique, not an enforced API contract. What the primary sources do support:

- A **fixed, unlikely-to-occur-in-content delimiter** (e.g. a full-line sentinel like
  `\n---VARIANT---\n`, not a common punctuation character) plus explicit instruction and a
  worked example in the prompt is the documented Anthropic-recommended shape for consistent
  freeform-formatted output in general (see the XML-tag examples above, same principle applies to
  a delimiter string).
- Collision is a real risk class: if the model's own rewritten text legitimately contains the
  delimiter string (e.g. a horizontal rule, a markdown separator, three dashes as
  em-dash-adjacent punctuation), naive `split(delimiter)` mis-segments. This is not vendor-specific
  — it is a property of any plain-text-marker convention and is exactly the class of failure a
  JSON array of strings is designed to avoid (each variant is a properly-escaped JSON string, so
  content that happens to contain `---` or newlines can't corrupt the split).
- JSON mode/Structured Outputs eliminates the collision-class failure but neither vendor's docs
  confirm a bare top-level array schema is supported — the safe, documented shape on both vendors
  is an **object wrapping an array**, e.g. `{"variants": ["...", "..."]}`, which every fetched
  example schema shape (object root) supports on both APIs.

## 3. Failure modes, mapped to the existing "keep what parsed cleanly" policy

| Failure | OpenAI (documented) | Anthropic (documented) | Engine handling (already-decided policy) |
|---|---|---|---|
| Model refuses / safety block | `refusal` field instead of parsed content | (no separate documented refusal field surfaced in fetched docs; Anthropic has a documented "server-side fallback" for streaming, see refusals-and-fallback guide) | Treat as zero variants parsed; engine returns whatever else parsed (here: none), does not error/retry |
| Truncated (hit token limit) mid-array/mid-JSON | `status === "incomplete"`, `incomplete_details.reason` | consumer must accumulate `text_delta`/`input_json_delta` fragments; an incomplete stream simply yields unparseable/partial JSON | Engine attempts a best-effort parse: valid JSON → use `variants` array as-is (even if `< N`); invalid/truncated JSON → fall back to delimiter-splitting the raw text, keep whatever segments look non-empty |
| Malformed JSON (model didn't comply with schema despite request) | Structured Outputs with a schema on the request should reject/repair at generation time when enabled; without it (plain JSON-mode/no schema), model can emit invalid JSON | Same distinction: Structured Outputs (`output_config.format`) is decode-constrained and "guarantees" validity per Anthropic's docs; without it, invalid JSON is possible | If schema-constrained mode is used and available, malformed-JSON should be rare per vendor's guarantee; Engine still defensively tries `JSON.parse`, catches, falls back to delimiter split of the raw text, and returns however many non-empty variants it can recover — never throws for this case |
| Wrong count (model returns fewer/more than N) | Not specifically documented as a distinct error class; it's a content compliance issue, not a protocol error | Same | Engine does not error on count mismatch — returns however many variants it successfully parsed, per the already-decided policy; callers must treat the result count as "0..N", not assume exactly N |

## 4. Recommendation

**Decision tree, evaluated once per `generate()` call:**

1. **N == 1**: no change from today — send the existing single-result prompt, no wrapping
   convention needed.
2. **N > 1, non-streaming (`stream: false`)**: instruct the model, in the Engine-built prompt, to
   return a single JSON object of the form `{"variants": ["...", "...", ...]}` with exactly N
   strings (each fully self-contained rewritten/generated text). This is the shape every fetched
   example from both vendors' Structured Outputs docs supports at the schema root (object, not
   bare array), so the *same* prompt convention and the *same* Engine-side parser work
   unmodified regardless of which vendor's Provider implementation is wired in. The
   Provider implementation may — as an internal, vendor-specific optimization invisible to the
   Engine — additionally pass a JSON-schema constraint on the request (OpenAI Structured Outputs /
   Anthropic `output_config.format`) so the vendor's own constrained decoding does most of the
   validity enforcement; the Engine's parser does not depend on this and must work from raw text
   alone, since the ADR requires the Provider to stay a thin passthrough and the Engine cannot
   assume any specific vendor's guarantee held.
   - **Parse**: `JSON.parse` the full text, read `.variants` if it's an array of strings. On any
     parse failure, or if `.variants` is missing/not an array, fall back to the delimiter strategy
     below against the same raw text (some models wrap JSON in prose or code fences despite
     instructions).
3. **N > 1, streaming (`stream: true`)**: per both vendors' own docs, a JSON payload — whether a
   plain JSON-mode string or a tool-use `input_json_delta` — is not usable piece-by-piece mid-stream;
   consumers are told to accumulate the full text and parse once complete
   (`content_block_stop` for Anthropic tool use; SDK "content.done" for OpenAI structured
   streaming). So for N > 1 the Engine **still emits `AsyncIterable<{ delta }>` chunks to the
   caller for a responsive UI** (undelimited raw text as it arrives — good enough for a "typing"
   effect) **but only splits it into discrete variants once the stream ends**, by running the same
   JSON-then-delimiter parse used in step 2 against the fully-buffered text. Concretely: keep
   `stream: true` meaning "deliver deltas as they arrive" (unchanged), and add a final
   post-stream-completion step that parses the buffered whole into variants and exposes it via a
   distinct value (e.g. a resolved property, or a final sentinel `{ delta: "", done: true, variants: [...] }`-shaped
   value) rather than pretending per-token deltas map to per-variant slices as they arrive — because
   neither vendor's API makes that promise.
4. **Delimiter fallback** (used whenever JSON parse fails, in both streaming and non-streaming
   paths): prompt instructs the model to separate variants with a fixed, content-unlikely sentinel
   on its own line, e.g. `\n===VARIANT===\n`, and to emit nothing else around it. Engine splits on
   that exact sentinel, trims each segment, and discards empty segments. This is the same
   "give an explicit template + example" technique Anthropic's own consistency-guidance docs
   recommend, generalized from XML tags to a delimiter line, and it is deliberately the
   *second* choice (not first) precisely because a plain delimiter can collide with generated
   content in a way a JSON string cannot.
5. **Failure policy** (already decided, reaffirmed here): regardless of which of the above paths
   is hit, if fewer than N variants are recoverable — due to refusal, truncation, malformed JSON,
   or delimiter collision — the Engine returns whatever variants parsed cleanly (0..N) rather than
   throwing an `EngineError` or silently retrying the provider call. This matches how the Engine
   already normalizes provider failures into partial/typed results elsewhere (`packages/core/src/errors.ts`)
   rather than doing hidden retries.

### Why not just always use the vendor's native multi-choice feature (OpenAI `n`)?

`n` is real, documented, and cheaper than asking one model call to author N variants inside a
single generation — but it exists only on OpenAI's legacy Chat Completions API (explicitly not
carried into the Responses API), has no Anthropic analogue, and returns an already-segmented
`choices` array rather than one text blob. Using it would mean the Anthropic Provider and the
OpenAI Provider produce structurally different results that the Engine would have to special-case
per vendor to reassemble into the same "one prompt-string in, one text/stream out" shape the ADR
requires — precisely the vendor leakage the ADR is written to prevent. It remains a legitimate
*internal* Provider-side optimization (an OpenAI Provider implementation could request `n` variants
and simply join them client-side with the Engine's own delimiter/JSON convention before returning
`{ text }`), but it cannot be the Engine's cross-vendor contract.

## Sources

- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/streaming-responses
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/build-with-claude/streaming
- https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/increase-consistency
- OpenAI `n` parameter / Chat Completions vs Responses API removal — community/reference
  corroboration (no single OpenAI guide page enumerates this in one place at time of writing):
  https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create ,
  https://platform.openai.com/docs/guides/migrate-to-responses ,
  https://community.openai.com/t/how-does-n-parameter-work-in-chat-completions/288725
