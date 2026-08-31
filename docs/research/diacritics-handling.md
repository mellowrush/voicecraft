# Research: diacritics on/off handling for Voice Profile output

Context: we want a user-facing setting so the Engine's output can be forced to
include or strip diacritical marks (e.g. Romanian ă, â, î, ș, ț) independent
of what the underlying AI vendor naturally produces. This doc summarizes
primary-source findings and recommends an implementation approach.

## 1. Do LLMs reliably follow "use/don't use diacritics" prompt instructions?

**Short answer: no vendor documentation states this is reliable, and the
available evidence points the other way.** There is no Anthropic or OpenAI
prompting-guide, model-card, or docs page that specifically addresses
diacritic-stripping/insertion instruction-following — this is not
vendor-documented behavior, and the claim below should be treated as an
empirical finding to verify with our own eval, not something a spec commits
to.

- Anthropic's own Claude Code tracker has an open bug about exactly this
  failure mode: Claude drops accents/cedillas/diacritics in non-English
  output (Portuguese, Vietnamese, French, Czech tested) *even when the
  system prompt explicitly says "NEVER omit accents"*, and the problem gets
  worse after context compaction / in long sessions.
  Source: [anthropics/claude-code issue #32886](https://github.com/anthropics/claude-code/issues/32886)
- Anthropic's general Claude 4.x prompting guidance says the models are
  trained to follow instructions very literally and benefits from explicit,
  repeated, context-rich instructions — but this guidance is about
  instruction-following in general, not diacritics specifically. There is no
  mention of diacritics in Anthropic's published prompting documentation.
- On the OpenAI side, there's a documented case of ASCII-only system-prompt
  instructions (meant to avoid encoding bugs in code output) bleeding over
  into conversational text and stripping legitimate accents from answers in
  Portuguese — i.e. instructions in one direction (no diacritics) tend to
  over-apply. Source: [anomalyco/opencode issue #12609](https://github.com/anomalyco/opencode/issues/12609)
- Community reports on the OpenAI Developer Forum describe inconsistent
  diacritic placement in Romanian output (e.g. producing "ã" instead of "ă"),
  and inconsistency run-to-run when asked to restore/correct diacritics.
  Source: [OpenAI Developer Community thread](https://community.openai.com/t/dall-e-does-not-correctly-place-diacritics-accent-marks-in-romanian-language/1250658),
  [translation quality thread](https://community.openai.com/t/translation-quality-inconsistent/993789)
- A 2025 academic study specifically on Romanian diacritic restoration with
  LLMs found that plain zero-shot instructions ("restore the diacritics")
  are not reliable on their own and require more structured/refined prompts
  to improve accuracy, with results still varying by model.
  Source: [arXiv:2511.13182, "Evaluating Large Language Models for Diacritic
  Restoration in Romanian Texts"](https://arxiv.org/pdf/2511.13182)

**Conclusion for this section:** neither vendor documents or guarantees
reliable diacritic on/off behavior from a prompt instruction alone. This is
a real, reported failure mode in both directions (dropping diacritics when
asked to keep them; not fully stripping, or over-stripping other text, when
asked to remove them), and degrades further with longer context. We should
not rely on prompting alone, and should verify actual behavior with our own
eval before shipping the feature, rather than trusting either vendor's
default behavior to hold.

## 2. Unicode NFD decomposition as a post-processing fallback

**How it works:** `text.normalize('NFD')` (Unicode Normalization Form D)
canonically decomposes precomposed characters into a base character plus one
or more combining marks, per the algorithm defined in
[Unicode Standard Annex #15 (UAX #15), "Unicode Normalization Forms"](https://unicode.org/reports/tr15/).
Most Latin-script accented letters (á, é, ñ, ç, ș, ț, ă has no canonical
decomposition — see caveat below) decompose into `letter + combining mark(s)`
drawn from the
[Combining Diacritical Marks block, U+0300–U+036F](https://www.unicode.org/charts/PDF/U0300.pdf)
(112 code points, floating marks that combine with the preceding base
character; see also
[Wikipedia's summary of the block, consistent with the Unicode chart](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks)).
Stripping every code point in that range after NFD decomposition (e.g.
`text.normalize('NFD').replace(/[̀-ͯ]/g, '')`) then yields the bare
ASCII/base-letter form.

**This works cleanly for:**
- **French** (é, è, ê, ë, à, ç, î, ï, ô, û, ù, ü, ÿ) — all standard precomposed
  accented letters decompose to base Latin letter + combining mark(s) in the
  U+0300–U+036F range.
- **Spanish** (á, é, í, ó, ú, ü) — same, decomposes cleanly. The exception is
  ñ (see caveat below).
- **Portuguese** (á, â, ã, à, ç, é, ê, í, ó, ô, õ, ú) — decomposes cleanly,
  including the tilde (U+0303, in-range).
- **Polish** for the acute-accent letters (ć, ń, ó, ś, ź) — these decompose
  to base + combining acute (in-range) and strip cleanly. Polish ł and ż
  are exceptions (see below).
- **Romanian** ș/ț (comma-below, U+0219/U+021B) and â/î/ă — see caveats,
  most decompose cleanly but there is vendor-specific baggage (below).

**Known exceptions / cases where naive NFD stripping produces wrong or
ambiguous results** (per the Unicode block chart and general Unicode
normalization documentation, cross-checked against language orthography):

1. **Characters with no canonical decomposition at all** — NFD only affects
   characters that *have* a canonical decomposition mapping in the Unicode
   Character Database. Several diacritic-bearing letters used by our target
   languages have none, so NFD is a no-op on them and they pass through
   unchanged:
   - **German ß** (U+00DF, LATIN SMALL LETTER SHARP S) — not a base+diacritic
     combination at all, it's a distinct letter; NFD does not decompose it.
     Needs an explicit substitution rule (ß → "ss") if ASCII-only output is
     wanted.
   - **Polish ł** (U+0142) and **ż** vs **ź** — ł does not decompose (it's a
     distinct letter, stroke-through-l, not l+combining mark); naive NFD+strip
     leaves it untouched, so an explicit ł→l mapping is needed if full
     "no diacritics" output is desired.
   - **Turkish dotless ı** (U+0131) and dotted **İ** (U+0130) — these encode
     a *letter identity* distinction in Turkish orthography (dotted vs
     dotless i are different letters, not the same letter with/without an
     accent), not a decomposable diacritic. NFD does nothing to them, and
     more importantly, casing/stripping logic that doesn't special-case
     Turkish i can silently produce the wrong letter (e.g. naive
     `toLowerCase()`/`toUpperCase()` under the wrong locale already breaks
     this; diacritic-stripping code should simply leave ı/İ alone).
   - **Danish/Norwegian ø, Icelandic þ/ð** — none of these decompose under
     NFD; they're independent letters and must be handled by an explicit
     map if a language needs them ASCII-folded (out of scope for our current
     target-language list, but worth noting for future expansion).

2. **Diacritics that are semantically a distinct *letter*, not a removable
   accent, even though they do decompose:**
   - **Turkish ç, ş, ğ** — these *do* canonically decompose (c+cedilla,
     s+cedilla, g+breve, all in U+0300–U+036F) so naive stripping "works"
     mechanically, but ç/ş/ğ are distinct letters of the Turkish alphabet
     with their own sort order and pronunciation, not a stylistic accent on
     c/s/g — stripping them changes meaning/is linguistically wrong, not
     merely informal. Turkish is therefore a language where a diacritics
     "off" toggle doesn't map to a real, accepted writing convention the way
     it does for Romanian.
   - **Vietnamese** — the heaviest case. Vietnamese stacks *two* kinds of
     marks on a single vowel: a vowel-quality mark (e.g. the horn on ơ/ư,
     U+031B COMBINING HORN, which is in the U+0300–U+036F range) and a tone
     mark (e.g. grave, acute, hook, tilde, dot-below — also in-range).
     Naive NFD+strip removes both indiscriminately, collapsing e.g. "ề"
     (e + grave + circumflex) down to "e" and "ơ"/"ư" (vowel + horn) down to
     "o"/"u". The horn distinguishes a different *vowel phoneme* (closer to
     a distinct letter than an accent), while the tone marks are more
     analogous to Romanian-style diacritics. A correct Vietnamese
     "no-diacritics" mode (a real, common informal convention, e.g. old SMS
     Vietnamese) needs to decide whether to preserve horn/breve
     vowel-quality marks and strip only tone marks, or fold everything to
     base Latin vowels — this is a policy decision, not something naive NFD
     stripping resolves correctly by default.
   - **Romanian ă, â** — technically NFD-decomposable (breve/circumflex,
     in-range), so mechanical stripping works, but is worth flagging
     alongside Turkish: informal "no-diacritics" Romanian typing conventions
     are well-established and *do* strip these (unlike Turkish), so Romanian
     is a safe target for naive stripping despite the same category of
     "combining mark = separate letter" argument technically applying.

3. **Spanish/Polish ñ, ń** are fine to strip (decompose in-range), but note
   ñ in Spanish is itself a distinct alphabet letter (comes after n in
   traditional collation) — same "distinct letter vs. accent" caveat as
   Turkish, yet Spanish speakers do not have an accepted "informal, no-ñ"
   writing convention analogous to Romanian's no-diacritics texting habit,
   so exposing the toggle for Spanish may be linguistically incorrect even
   though it's technically strippable.

Primary sources for this section: [UAX #15 Unicode Normalization
Forms](https://unicode.org/reports/tr15/) (defines NFD/canonical
decomposition), [Unicode Combining Diacritical Marks block chart,
U+0300–U+036F](https://www.unicode.org/charts/PDF/U0300.pdf), and the
Unicode Character Database decomposition mappings (which determine, per
code point, whether a canonical decomposition exists at all — this is why
ß, ł, ı, ø, þ, ð are unaffected by NFD while é, ș, ç, ñ are affected).

## 3. Which languages have a meaningful diacritics on/off toggle?

Based on the analysis above plus known informal writing conventions:

**Meaningful toggle (real, accepted "strip for informal/technical writing"
convention exists, and naive-or-lightly-augmented NFD stripping is
adequate):**
- **Romanian** — the canonical case; texting/informal Romanian routinely
  drops ă/â/î/ș/ț. Naive NFD stripping works out of the box.
- **French** — accents are sometimes dropped informally (much less
  standardized than Romanian, but common in old SMS/all-caps contexts, and
  in some official contexts capital letters historically omitted accents).
  Naive NFD stripping works.
- **Portuguese** — similar informal-dropping pattern to French. Naive NFD
  stripping works.
- **Vietnamese** — informal "no-diacritics" Vietnamese (typing without a
  Vietnamese keyboard) is an extremely common, real convention, but see the
  horn-vs-tone caveat above: full policy needs a decision on whether to
  keep vowel-quality marks (ơ/ư → o/u vs. preserving via digraphs). Needs a
  Vietnamese-specific post-processing rule beyond naive stripping.

**Toggle exists but is linguistically fraught / low value — recommend NOT
exposing by default:**
- **Turkish** — ç/ş/ğ/ı are alphabet letters, not accents; there's no
  accepted "informal Turkish without diacritics" convention the way Romanian
  has one. Offering the toggle risks producing text that reads as simply
  wrong/misspelled rather than "informal."
- **Spanish** — ñ is a distinct letter with no informal drop convention;
  á/é/í/ó/ú accents are occasionally dropped informally (much like French)
  but there's less of a cultural convention around it than Romanian.
  Low priority; could be added later using the same mechanism as
  French/Portuguese if there's demand.
- **Polish, German** — no meaningful accepted convention for stripping
  (German speakers who ASCII-fold use ae/oe/ue/ss digraphs, not naive
  stripping — see §2). If ever supported, requires the digraph
  substitution table, not naive NFD, and is a different UX ("ASCII
  transliteration" rather than "diacritics off").

**No meaningful toggle at all — never show the setting:**
- **English** — no diacritics in normal orthography (loanwords like "café"
  are the rare exception and dropping the accent is already the norm, not a
  toggle-worthy choice).
- **CJK languages (Chinese, Japanese, Korean)** — no diacritics/combining
  marks concept applies; not a Latin-script accent system at all.

## 4. Recommendation

**Prompt instruction + Unicode NFD-based post-processing as a safety net —
not prompt-only, not post-processing-only.**

Rationale:
- Prompt-only is not reliable per §1: both vendors have documented
  instruction-following gaps around diacritics specifically (Claude:
  drops required accents even under explicit "never omit" instructions,
  worse in long context; OpenAI: ASCII-style instructions over-apply and
  bleed into unrelated text). We cannot guarantee correct behavior from the
  provider text alone, and this is exactly the kind of vendor-behavior gap
  the Engine/Provider boundary exists to paper over.
- Post-processing-only (skip the prompt instruction, just always strip
  after generation) is wasteful and lossy: if the user wants diacritics ON,
  post-processing can't *add* missing diacritics that the model dropped —
  NFD only removes marks, it can't restore correct ă/â/î/ș/ț placement.  So
  post-processing can only be the fix for the "off" direction, not the "on"
  direction.
- Therefore: **for diacritics ON**, rely on a clear, explicit prompt
  instruction (repeated/near the generation point per the Claude Code
  issue's community workaround), with no reliable automatic fallback for
  under-production of diacritics — this residual risk should be documented
  as a known limitation, to be checked with an eval rather than assumed.
  **For diacritics OFF**, use an explicit prompt instruction *and* apply
  the NFD-decompose + strip-combining-marks post-processing pass
  unconditionally as a deterministic safety net, since it costs nothing
  and catches whatever the model failed to strip.

**Implementation notes for the post-processing safety net:**
- Base implementation: `text.normalize('NFD').replace(/[̀-ͯ]/g, '')`
  is sufficient and correct for Romanian, French, Portuguese (our initial
  target languages).
- For **Vietnamese**, if/when supported, do not use the naive regex as-is:
  decide explicitly whether to strip only tone marks (grave U+0300, acute
  U+0301, hook-above U+0309, tilde U+0303, dot-below U+0323) while
  preserving the horn (U+031B) and breve (U+0306) vowel-quality marks (which
  change the base vowel identity), or provide a dedicated
  Vietnamese-to-ASCII table. Do not ship Vietnamese diacritics-off support
  using the generic stripping code path without this decision made
  explicitly.
- Do **not** offer the diacritics toggle for Turkish, Polish, German, or
  Spanish at this time — no accepted informal-writing convention backs the
  "off" state for these languages, and Polish/German additionally need
  digraph substitution (ae/oe/ue/ss, ł→l) rather than naive stripping,
  which is a different feature ("ASCII transliteration") from a diacritics
  toggle.
- Never show the toggle for English or CJK languages — diacritics are not
  a meaningful concept for their normal orthography.
- Treat §1's conclusion as an open empirical question: before shipping,
  run a small eval (both vendors, both toggle states, Romanian + French +
  Portuguese) to confirm actual on/off compliance rates, since no vendor
  documentation guarantees this behavior and we found reports of it failing
  in both directions.

## Sources

- Anthropic Claude Code issue on dropped diacritics: https://github.com/anthropics/claude-code/issues/32886
- OpenCode issue on ASCII-only instructions breaking accented output: https://github.com/anomalyco/opencode/issues/12609
- OpenAI Developer Community — Romanian diacritics placement: https://community.openai.com/t/dall-e-does-not-correctly-place-diacritics-accent-marks-in-romanian-language/1250658
- OpenAI Developer Community — translation consistency: https://community.openai.com/t/translation-quality-inconsistent/993789
- arXiv 2511.13182 — "Evaluating Large Language Models for Diacritic Restoration in Romanian Texts: A Comparative Study": https://arxiv.org/pdf/2511.13182
- Unicode Standard Annex #15, Unicode Normalization Forms (defines NFD/canonical decomposition): https://unicode.org/reports/tr15/
- Unicode Combining Diacritical Marks block chart, U+0300–U+036F: https://www.unicode.org/charts/PDF/U0300.pdf
- Wikipedia, Combining Diacritical Marks (cross-check of the block's contents against the Unicode chart): https://en.wikipedia.org/wiki/Combining_Diacritical_Marks
