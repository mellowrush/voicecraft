---
name: Voicecraft
description: Rewrites text into a chosen voice — a calm instrument panel for a hotkey-driven writing tool
colors:
  stamp-red: "#c81f2c"
  stamp-red-deep: "#a81a22"
  mint-pulse: "#89ecb0"
  ink: "#272c30"
  graphite: "#60737a"
  slate-mist: "#7b8e95"
  dove-gray: "#a6b4ba"
  pale-slate: "#e3e8ea"
  warm-paper: "#faf8f4"
  pure-white: "#ffffff"
  error: "#b45309"
  success: "#1f7a4d"
typography:
  body:
    fontFamily: "Inter, Suisse Intl, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "JetBrains Mono, Geist Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 500
    letterSpacing: "0.15em"
rounded:
  panel: "2px"
  input: "6px"
  control: "8px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
motion:
  interactive:
    duration: "280ms"
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)"
  loadingSweep:
    duration: "1.1s"
    easing: "cubic-bezier(0.65, 0, 0.35, 1)"
components:
  button-primary:
    backgroundColor: "{colors.stamp-red}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.control}"
    padding: "9px 22px"
  button-primary-hover:
    backgroundColor: "{colors.stamp-red-deep}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    size: "26px"
---

# Design System: Voicecraft

## 1. Overview

**Creative North Star: "The Field Notebook"**

Voicecraft reads as a hand-stamped field notebook, not a manufactured SaaS product: the calm legibility of an instrument panel (one accent color, everything scannable mid-task, no decoration competing for attention) paired with the warmth of a well-used notebook (a hard-edged circular badge mark like a rubber stamp, monospace labels as marginal annotations rather than corporate section headers). It is precise, calm, and trustworthy — built by a careful engineer for their own daily use, not marketed to a broader audience.

Successor to "The Studio Cockpit" — same restrained, functional temperament, re-grounded in a bolder, harder-edged mark language (four concrete references: an ink-brush tea logo, a noir detective silhouette, a bold graphic bakery mark, a flat pop-art figure) instead of a soft blue/serif identity.

The system explicitly rejects generic SaaS-dashboard grammar: no hero-metric tiles, no gradient body text, no tiny uppercase eyebrows stacked above every section "because landing pages do this," no numbered-step scaffolding unless the content is a genuine sequence (onboarding's 3-step Accessibility grant is a real sequence; nothing else on these screens should copy that pattern by reflex).

**Key Characteristics:**
- One accent (stamp red) carries all primary actions and focus state; nothing else competes for that role — the One-Red Rule.
- Ambient elevation, not structural: panels sit flat at rest, shadow appears only when something floats above the OS chrome (HUD, modals, toast) — unchanged from the previous identity, a functional signal independent of the aesthetic restyle.
- Monospace, uppercase, wide-tracked labels mark structure (section labels, panel labels, field labels) — used as quiet annotation, not decoration.
- The circular instrument-dial badge is the one deliberately expressive mark in an otherwise restrained, sans-serif system; the wordmark itself is plain, no gradient or serif treatment.
- Motion carries the system's remaining expressive character: a spring-overshoot easing on interactive transitions and an oscillating gauge-needle sweep as the loading signature, in place of a plain spin.

## 2. Colors

A restrained palette: one red family carries every interactive/primary role, a warm mint marks "live/success" state sparingly, and a long ink-to-white neutral ramp does the rest of the work.

### Primary
- **Stamp Red** (#c81f2c): primary CTA background (`run-btn`, `btn-solid`, `new-btn`, active mode/HUD-accept), the color a user's eye should land on for "the thing to press." Darkened from the reference mark's raw red (#f91429) so white button text clears WCAG AA (5.7:1).
- **Stamp Red Deep** (#a81a22): hover/pressed state for stamp-red elements — one step darker, never used at rest. Also the focus-ring/input-focus-border color (previously a separate deeper blue; the palette now has only one accent family, so focus reuses its darker step rather than a second hue).

### Neutral
- **Ink** (#272c30): primary text, active-state text, toast background.
- **Graphite** (#60737a): secondary text, icon-button default color, field labels.
- **Slate Mist** (#7b8e95): tertiary text (profile descriptions, edit affordance).
- **Dove Gray** (#a6b4ba): placeholder/empty-state text, disabled-adjacent text, diff-deletion strikethrough.
- **Pale Slate** (#e3e8ea): borders, dividers, view-toggle track background.
- **Warm Paper** (#faf8f4): the canvas tint — hover backgrounds, selected-item background, mode-toggle track, onboarding icon circle. A barely-warm off-white, deliberately more restrained than the reference marks' visible parchment tone (which sits closer to #f6e7d2–#faefd3) — this is the "resting" surface color that makes stamp red read as active.
- **Pure White** (#ffffff): card/panel surfaces (sidebar, main, modal, HUD, onboarding card) sitting on the warm-paper canvas — unchanged from before; the canvas warmed, the surfaces stayed pure white so the figure/ground contrast is preserved.

### Accent (state only)
- **Mint Pulse** (#89ecb0): "live" indicator dot (toast, granted status-pill), diff-addition highlight. Reserved for positive/live confirmation, never a UI chrome color. Unchanged — already a distinct hue non-competing with the accent, no reason for it to move with the rest of the palette.
- **Error** (#b45309): validation/run errors only (`result-error`, `settings-error`). Moved off red now that red is the primary accent — an amber tone keeps it clearly distinct from "press me" (4.7:1+ against both pure-white and warm-paper). Never a border or background — text only, so it never competes with the One-Red Rule for chrome.
- **Success** (#1f7a4d): confirmation text only (`settings-saved`, granted status-pill). Unchanged.

### Named Rules
**The One-Red Rule.** Every interactive/primary surface uses stamp-red or stamp-red-deep — never a second brand hue. If a screen needs a second accent, that's a sign the interaction, not the palette, needs rethinking. (Successor to the previous identity's One-Blue Rule — same discipline, new hue.)

## 3. Typography

**Body Font:** Inter (with Suisse Intl, ui-sans-serif, system-ui, -apple-system, sans-serif fallback)
**Label/Mono Font:** JetBrains Mono (with Geist Mono, ui-monospace, monospace fallback)

**Character:** A restrained sans carries all reading and interaction text. Monospace, uppercase, wide-tracked type marks structure — never body copy. There is no longer a dedicated display/serif face: the previous identity's gradient-serif wordmark is retired outright rather than replaced, since the new mark (the circular badge) already carries the system's one deliberately expressive gesture — a second expressive typeface would compete with it rather than complement it.

### Hierarchy
- **Title** (600, 15–18px): modal headings, active-profile name, onboarding card title — now the largest text weight in the system, since Display was retired.
- **Body** (400, 12.5–14px, 1.43–1.6 line-height): compose textareas/result panels, HUD result text, onboarding body copy.
- **Label** (500, 10–11px, uppercase, 0.1–0.15em tracking, mono): section labels, panel labels, field labels, HUD profile tag, status pill.
- **Micro** (400–500, 9–12px): timestamps-equivalent chrome — hints, edit affordances, hud-kbd shortcuts, profile descriptions.

### Named Rules
**The Mono-Is-Structure Rule.** Monospace type never carries prose — only short, uppercase, tracked labels that annotate structure (a section, a field, a shortcut). The moment mono type wraps to a second line, it's the wrong font for that content.

## 4. Elevation

Ambient, not structural. Panels at rest (sidebar, main panel) are flat — no shadow between them; separation comes from the canvas gap, not depth cues. Shadow is reserved for elements that visually float above the OS: the HUD, onboarding card, modals, and toast all carry `shadow-xl`, while resting cards on the main window carry only the barely-there `shadow-subtle-2` to lift them off the canvas. Depth signals "this is floating above your other apps," not "this panel outranks that one." Unchanged from the previous identity — a functional window-layering signal, independent of the aesthetic restyle.

### Shadow Vocabulary
- **Ambient rest** (`box-shadow: rgba(63,70,75,0.1) 0px 1px 3px 0px, rgba(63,70,75,0.1) 0px 0px 0px 1px`): sidebar, main panel — just enough to separate surface from canvas.
- **Floating** (`box-shadow: rgba(63,70,75,0.1) 0px 21px 44px -32px, rgba(39,44,48,0.2) 0px 26px 30px -23px, rgba(39,44,48,0.05) 0px 14px 40px 0px, rgba(39,44,48,0.08) 0px 0px 0px 1px`): HUD, onboarding card, modal, toast — anything that appears above other windows/apps.

### Named Rules
**The Floating-Only Rule.** `shadow-xl` is reserved for surfaces that visually detach from the app (HUD, modal, toast, onboarding). Never apply it to in-window panels at rest — that's what ambient shadow is for. Note: corner radius no longer distinguishes floating from in-window surfaces (see §5 Cards / Containers) — shadow is now the only floating-vs-in-window signal.

## 5. Components

### Mark
- **Badge:** a circular "instrument dial" badge carries the system's one deliberately expressive gesture — filled with the stamp-red accent (previously cobalt during prototyping), a white directional stroke inside. Circular, so it sits outside the corner-radius grammar below.
- **Wordmark:** plain sans/mono text next to the badge, no gradient, no serif — the badge alone carries the expressive weight.

### Buttons
- **Shape:** 8px radius for actions and icon-only buttons alike — replaces the previous identity's full pill. A moderate, structured rounding: clearly not a capsule, still soft enough to read as a clickable target rather than a panel edge.
- **Primary:** stamp-red background, white text, 8px radius, generous horizontal padding (9px 22px for run-btn, 8px 18px for btn-solid) — sized for a deliberate "I'm ready to act" press, not a dense toolbar icon.
- **Hover / Focus:** background steps to stamp-red-deep on hover. Interactive transitions use the spring-overshoot easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`, 280ms) — hover scales to 1.03, press scales to 0.95. This replaces the previous identity's "no transform on primary; icon buttons lift 1px" rule with one consistent transform-based motion signature across every button. Disabled drops to 0.5–0.6 opacity with default cursor.
- **Ghost:** transparent background, graphite text, 8px radius, border shifts to stamp-red on hover — used for cancel/dismiss actions (`btn-ghost`).
- **Icon buttons:** 26×26px, 8px radius, border for the settings/copy variant, borderless for the new-profile variant which is filled stamp-red instead.
- **Loading:** the run button's loading state uses the gauge-needle sweep (see Motion below), not a plain spinner.

### Segmented controls (mode-toggle, view-toggle)
- **Style:** 8px-radius track (warm-paper or pale-slate background), inner buttons also 8px radius — replaces the previous full-pill track. Active state gets a solid fill (stamp-red for mode-toggle, ink for view-toggle) with white text.
- **Character:** the deliberate, structured shape still signals "pick one" clearly — no underline tabs, no bare text buttons — just less soft/capsule than before.

### Cards / Containers
- **Corner style:** 2px, unified across in-window panels (sidebar, main) and floating surfaces (modal, HUD, onboarding card) — replaces the previous identity's 6px/10–14px split. Corner radius no longer distinguishes floating from in-window; the shadow system (§4) is now the only signal for that distinction.
- **Background:** pure white on the warm-paper canvas.
- **Shadow strategy:** see Elevation — ambient for in-window panels, floating shadow for anything overlaying other apps. Unchanged.
- **Border:** floating surfaces (HUD, onboarding, modal-adjacent inputs) add a 1px pale-slate border alongside their shadow; in-window panels rely on shadow alone.
- **Internal padding:** generous and consistent — 24px horizontal on the main panel's header/compose/action-bar, 22–24px on floating cards. Deliberate, not cramped, even where individual list rows (profile-item) stay compact for scanability.
- **Expand/reveal motion:** card expansion (e.g. history-card body) uses the same spring-overshoot easing as buttons, scaling in from the top (`transform-origin: top`) rather than a plain height/opacity fade.

### Inputs / Fields
- **Style:** 1px pale-slate border, 6px radius (unchanged — out of scope for the buttons/segmented/panels shape revision), ink text.
- **Focus:** border shifts to stamp-red-deep plus a 3px soft stamp-red glow (`box-shadow: 0 0 0 3px rgba(200,31,44,0.12)`) — the same focus signature on every input, textarea, and context field in the app.
- **Error:** dedicated amber (#b45309) reserved for error text only — not used as a border or background color anywhere, keeping the One-Red Rule intact for chrome.

### List items (profile-item)
- **Style:** transparent at rest, warm-paper background + stamp-red border on hover/selected, name text shifts to stamp-red-deep when selected.
- **Reveal:** a secondary "edit" affordance fades in on hover only — keeps the resting list visually quiet.

### Status pill / badges
- **Style:** pill-shaped (unchanged — out of scope for the buttons/segmented/panels shape revision), mono uppercase label, pale-slate background at rest with a graphite dot; shifts to a soft mint-tinted background with a mint dot once a condition is met (e.g. Accessibility granted). The only place mint appears as a background, not just an accent dot.

## 6. Motion

Two motion vocabularies cover the system: interactive state transitions, and a loading motif that replaces plain spinning.

### Interactive transitions
- **Easing:** `cubic-bezier(0.34, 1.56, 0.64, 1)`, 280ms — a spring/overshoot curve, applied to hover/press/focus on buttons, ghost buttons, cards, and inputs, and to card expand/collapse.
- **Character:** a slight overshoot on hover (scale 1.02–1.03) and undershoot on press (scale 0.95) gives every interactive surface a tactile, slightly "clicky" feel — inspired by the reference marks' hand-stamped, ink-brush character carried into motion rather than texture.

### Loading motif
- **The gauge-needle sweep:** loading states (the run button, HUD processing indicator) use an oscillating ring/needle animation — `cubic-bezier(0.65, 0, 0.35, 1)`, 1.1s, rotating between -16deg and 196deg and back — rather than a plain continuous spin. Reads as an instrument dial finding its reading, tying the loading motif directly to the badge mark's own dial shape.
- **Reduced motion:** both the interactive spring and the gauge-needle sweep are disabled under `prefers-reduced-motion: reduce`; loading state should fall back to a static indicator rather than no feedback at all.

### Named Rules
**The Needle-Not-Spinner Rule.** Wherever the app shows indeterminate progress, use the gauge-needle sweep — never a plain circular spinner. A plain spin is a sign the loading state hasn't been given the system's own motion signature.

## 7. Do's and Don'ts

### Do:
- **Do** keep stamp-red/stamp-red-deep as the only interactive accent across window app, HUD, and onboarding — one voice, three surfaces (the One-Red Rule).
- **Do** use ambient shadow for in-window panels and floating shadow only for elements that overlay other apps (HUD, modal, toast, onboarding).
- **Do** keep mono/uppercase/tracked type reserved for short structural labels, never prose.
- **Do** give primary actions generous, deliberate padding (8px-radius CTAs, 22–24px card padding) even where list rows stay compact for scanability — spacious and deliberate is the target character for buttons, cards, and modals.
- **Do** state status, permissions, and errors plainly (see onboarding's Accessibility copy) — no marketing softening.
- **Do** apply the spring-overshoot easing consistently across every interactive transition — a mix of easing curves across buttons/cards would read as inconsistent rather than deliberate.
- **Do** use the gauge-needle sweep for every loading/indeterminate-progress state — see the Needle-Not-Spinner Rule.

### Don't:
- **Don't** introduce a second brand hue for "primary" actions — that's the One-Red Rule.
- **Don't** use hero-metric tiles, gradient body text, or tiny uppercase eyebrow labels stacked above every section — generic SaaS-dashboard grammar this system explicitly rejects.
- **Don't** add numbered-step scaffolding outside a genuine sequence — onboarding's 3-step grant flow earns it because it's a real ordered process, nothing else should copy the pattern by reflex.
- **Don't** apply `shadow-xl` to panels at rest inside the window app — that shadow is reserved for surfaces floating above other windows.
- **Don't** stack nested cards or repeat identical icon+heading+text card grids — not part of this system's vocabulary today, and shouldn't be introduced as a default.
- **Don't** reintroduce a serif/display typeface for headings or the wordmark — that expressive role now belongs to the badge mark alone.
- **Don't** apply a plain circular spin for loading — the gauge-needle sweep is the app's loading signature now.
