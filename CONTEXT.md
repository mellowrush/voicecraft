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
