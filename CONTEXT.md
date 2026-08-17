# Voicecraft

Voicecraft rewrites text into a chosen voice. This context covers the core engine: the voice-profile schema and the rewrite/generate contract shared by every consuming app (Mac app, browser extensions).

## Language

**Voice Profile**:
The data that describes a voice to rewrite text into — an id, display name, freeform description, and optional tags/examples/constraints/language. Predefined (built-in) and custom (user-authored) voices are both just Voice Profiles; there is no separate schema or type for either.
_Avoid_: Character, persona, voice preset

**Constraints**:
Imperative do's-and-don'ts a Voice Profile carries (e.g. "never use profanity") that the engine must honor when rewriting, kept separate from the profile's descriptive prose.

**Examples**:
Optional few-shot `{input, output}` pairs on a Voice Profile that demonstrate the voice in action, used to steer generation quality.

**Mode**:
Which of the two core operations the engine performs — `rewrite` (transform existing text) or `generate` (produce new text from an instruction). The only mode axis; context, streaming, and display are separate, orthogonal concerns.
_Avoid_: Operation, action

**Context**:
An optional freeform string carrying format/length hints for a rewrite or generate call (e.g. "formal business email", "twitter reply, keep under 280 chars"), independent of the Voice Profile in use.

**Engine**:
The core's single entry point (`createEngine({ provider }).generate(request)`) that turns a Voice Profile, text, mode, and optional context into rewritten/generated output. Owns prompt construction and error normalization; the only thing an app talks to.
_Avoid_: Client, service

**Provider**:
The injected function `(prompt, opts) => text/stream` an app supplies to an Engine — the seam between core and a specific AI backend. A Provider only ever receives a finished prompt string; it never sees a Voice Profile, and it owns its own auth/secrets entirely opaquely to core.
_Avoid_: Model, backend, adapter

**EngineError**:
The single typed error shape (`code` + optional `cause`/`retryAfterMs`) every Engine failure normalizes into, regardless of what a Provider actually threw — the stable surface apps build retry/error UI against.
_Avoid_: ProviderError (raw provider errors don't leak through)
