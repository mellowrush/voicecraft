---
name: Voicecraft
description: Rewrites text into a chosen voice — a calm instrument panel for a hotkey-driven writing tool
colors:
  iris-blue: "#3161df"
  cobalt: "#306fe8"
  mint-pulse: "#89ecb0"
  midnight-iris: "#2c65d3"
  ink: "#272c30"
  graphite: "#60737a"
  slate-mist: "#7b8e95"
  dove-gray: "#a6b4ba"
  pale-slate: "#e3e8ea"
  lavender-mist: "#f0f5fe"
  pure-white: "#ffffff"
  error: "#b3261e"
  success: "#1f7a4d"
typography:
  display:
    fontFamily: "Playfair Display, Selecta, Georgia, serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.3px"
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
  md: "6px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.full}"
    padding: "9px 22px"
  button-primary-hover:
    backgroundColor: "{colors.midnight-iris}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    rounded: "{rounded.md}"
    size: "26px"
---

# Design System: Voicecraft

## 1. Overview

**Creative North Star: "The Studio Cockpit"**

Voicecraft reads as an instrument panel built by hand, not manufactured by a design team: the calm legibility of a cockpit (one accent color, everything scannable mid-task, no decoration competing for attention) paired with the warmth of a studio notebook (a serif gradient wordmark as a handcrafted signature, monospace labels as marginal annotations rather than corporate section headers). It is precise, calm, and trustworthy — built by a careful engineer for their own daily use, not marketed to a broader audience.

The system explicitly rejects generic SaaS-dashboard grammar: no hero-metric tiles, no gradient body text, no tiny uppercase eyebrows stacked above every section "because landing pages do this," no numbered-step scaffolding unless the content is a genuine sequence (onboarding's 3-step Accessibility grant is a real sequence; nothing else on these screens should copy that pattern by reflex).

**Key Characteristics:**
- One accent (cobalt/iris-blue) carries all primary actions and focus state; nothing else competes for that role.
- Ambient elevation, not structural: panels sit flat at rest, shadow appears only when something floats above the OS chrome (HUD, modals, toast).
- Monospace, uppercase, wide-tracked labels mark structure (section labels, panel labels, field labels) — used as quiet annotation, not decoration.
- A single serif/gradient wordmark is the one deliberately expressive mark in an otherwise restrained, sans-serif system.

## 2. Colors

A restrained palette: one blue family carries every interactive/primary role, a warm mint marks "live/success" state sparingly, and a long ink-to-white neutral ramp does the rest of the work.

### Primary
- **Cobalt** (#306fe8): primary CTA background (`run-btn`, `btn-solid`, `new-btn`, active mode/HUD-accept), the color a user's eye should land on for "the thing to press." Darkened slightly from an earlier `#3e79ea` so white button text clears WCAG AA (4.6:1).
- **Iris Blue** (#3161df): focus rings, input focus borders, hover states on ghost/secondary controls, HUD profile label — a slightly deeper accent for "system is listening to you" states rather than "press me."
- **Midnight Iris** (#2c65d3): hover/pressed state for cobalt elements — one step darker, never used at rest.

### Neutral
- **Ink** (#272c30): primary text, active-state text, toast background.
- **Graphite** (#60737a): secondary text, icon-button default color, field labels.
- **Slate Mist** (#7b8e95): tertiary text (profile descriptions, edit affordance).
- **Dove Gray** (#a6b4ba): placeholder/empty-state text, disabled-adjacent text, diff-deletion strikethrough.
- **Pale Slate** (#e3e8ea): borders, dividers, view-toggle track background.
- **Lavender Mist** (#f0f5fe): the canvas tint — hover backgrounds, selected-item background, mode-toggle track, onboarding icon circle. This is the "resting" surface color that makes cobalt read as active.
- **Pure White** (#ffffff): card/panel surfaces (sidebar, main, modal, HUD, onboarding card) sitting on the lavender canvas.

### Accent (state only)
- **Mint Pulse** (#89ecb0): "live" indicator dot (toast, granted status-pill), diff-addition highlight. Reserved for positive/live confirmation, never a UI chrome color.
- **Error** (#b3261e): validation/run errors only (`result-error`, `settings-error`). Never a border or background — text only, so it never competes with the One-Blue Rule for chrome.
- **Success** (#1f7a4d): confirmation text only (`settings-saved`, granted status-pill).

### Named Rules
**The One-Blue Rule.** Every interactive/primary surface uses cobalt or iris-blue — never a second brand hue. If a screen needs a second accent, that's a sign the interaction, not the palette, needs rethinking.

## 3. Typography

**Display Font:** Playfair Display (with Selecta, Georgia, serif fallback)
**Body Font:** Inter (with Suisse Intl, ui-sans-serif, system-ui, -apple-system, sans-serif fallback)
**Label/Mono Font:** JetBrains Mono (with Geist Mono, ui-monospace, monospace fallback)

**Character:** A restrained sans carries all reading and interaction text; a single serif appears only in the wordmark, where its gradient fill makes it read as a signature rather than a heading. Monospace, uppercase, wide-tracked type marks structure — never body copy.

### Hierarchy
- **Display** (500, 20px, 1.2 line-height, -0.3px tracking): wordmark only, gradient-filled (`linear-gradient(180deg, #5897f7, #3872e6)` clipped to text).
- **Title** (600, 15–18px): modal headings, active-profile name, onboarding card title.
- **Body** (400, 12.5–14px, 1.43–1.6 line-height): compose textareas/result panels, HUD result text, onboarding body copy.
- **Label** (500, 10–11px, uppercase, 0.1–0.15em tracking, mono): section labels, panel labels, field labels, HUD profile tag, status pill.
- **Micro** (400–500, 9–12px): timestamps-equivalent chrome — hints, edit affordances, hud-kbd shortcuts, profile descriptions.

### Named Rules
**The Mono-Is-Structure Rule.** Monospace type never carries prose — only short, uppercase, tracked labels that annotate structure (a section, a field, a shortcut). The moment mono type wraps to a second line, it's the wrong font for that content.

## 4. Elevation

Ambient, not structural. Panels at rest (sidebar, main panel) are flat — no shadow between them; separation comes from the lavender canvas gap, not depth cues. Shadow is reserved for elements that visually float above the OS: the HUD, onboarding card, modals, and toast all carry `shadow-xl`, while resting cards on the main window carry only the barely-there `shadow-subtle-2` to lift them off the canvas. Depth signals "this is floating above your other apps," not "this panel outranks that one."

### Shadow Vocabulary
- **Ambient rest** (`box-shadow: rgba(63,70,75,0.1) 0px 1px 3px 0px, rgba(63,70,75,0.1) 0px 0px 0px 1px`): sidebar, main panel — just enough to separate surface from canvas.
- **Floating** (`box-shadow: rgba(63,70,75,0.1) 0px 21px 44px -32px, rgba(39,44,48,0.2) 0px 26px 30px -23px, rgba(39,44,48,0.05) 0px 14px 40px 0px, rgba(39,44,48,0.08) 0px 0px 0px 1px`): HUD, onboarding card, modal, toast — anything that appears above other windows/apps.

### Named Rules
**The Floating-Only Rule.** `shadow-xl` is reserved for surfaces that visually detach from the app (HUD, modal, toast, onboarding). Never apply it to in-window panels at rest — that's what ambient shadow is for.

## 5. Components

### Buttons
- **Shape:** pill for actions (`radius-full`, 9999px), 6px radius for icon-only buttons.
- **Primary:** cobalt background, white text, pill-shaped, generous horizontal padding (9px 22px for run-btn, 8px 18px for btn-solid) — sized for a deliberate "I'm ready to act" press, not a dense toolbar icon.
- **Hover / Focus:** background steps to midnight-iris on hover; disabled drops to 0.5–0.6 opacity with default cursor. No transform on primary buttons; icon buttons (`new-btn`) lift 1px on hover for a lighter, secondary-weight interaction.
- **Ghost:** transparent background, graphite text, pill radius, darkens to ink on hover — used for cancel/dismiss actions (`btn-ghost`).
- **Icon buttons:** 26×26px, 6px radius, border for the settings/copy variant, borderless for the new-profile variant which is filled cobalt instead.

### Segmented controls (mode-toggle, view-toggle)
- **Style:** pill-shaped track (lavender-mist or pale-slate background), inner buttons also pill-shaped, active state gets a solid fill (cobalt for mode-toggle, ink for view-toggle) with white text.
- **Character:** the deliberate, spacious pill shape signals "pick one" clearly — no underline tabs, no bare text buttons.

### Cards / Containers
- **Corner style:** 6px for in-window panels (sidebar, main), 10–14px for floating surfaces (modal, HUD, onboarding card) — floating elements get visibly softer corners than structural panels.
- **Background:** pure white on the lavender-mist canvas.
- **Shadow strategy:** see Elevation — ambient for in-window panels, floating shadow for anything overlaying other apps.
- **Border:** floating surfaces (HUD, onboarding, modal-adjacent inputs) add a 1px pale-slate border alongside their shadow; in-window panels rely on shadow alone.
- **Internal padding:** generous and consistent — 24px horizontal on the main panel's header/compose/action-bar, 22–24px on floating cards. Deliberate, not cramped, even where individual list rows (profile-item) stay compact for scanability.

### Inputs / Fields
- **Style:** 1px pale-slate border, 6px radius, ink text.
- **Focus:** border shifts to iris-blue plus a 3px soft cobalt glow (`box-shadow: 0 0 0 3px rgba(49,97,223,0.12)`) — the same focus signature on every input, textarea, and context field in the app.
- **Error:** dedicated red (#b3261e) reserved for error text only — not used as a border or background color anywhere, keeping the palette's one-blue rule intact for chrome.

### List items (profile-item)
- **Style:** transparent at rest, lavender-mist background + iris-blue border on hover/selected, name text shifts to midnight-iris when selected.
- **Reveal:** a secondary "edit" affordance fades in on hover only — keeps the resting list visually quiet.

### Status pill / badges
- **Style:** pill-shaped, mono uppercase label, pale-slate background at rest with a graphite dot; shifts to a soft mint-tinted background with a mint dot once a condition is met (e.g. Accessibility granted). The only place mint appears as a background, not just an accent dot.

## 6. Do's and Don'ts

### Do:
- **Do** keep cobalt/iris-blue as the only interactive accent across window app, HUD, and onboarding — one voice, three surfaces.
- **Do** use ambient shadow for in-window panels and floating shadow only for elements that overlay other apps (HUD, modal, toast, onboarding).
- **Do** keep mono/uppercase/tracked type reserved for short structural labels, never prose.
- **Do** give primary actions generous, deliberate padding (pill CTAs, 22–24px card padding) even where list rows stay compact for scanability — spacious and deliberate is the target character for buttons, cards, and modals.
- **Do** state status, permissions, and errors plainly (see onboarding's Accessibility copy) — no marketing softening.

### Don't:
- **Don't** introduce a second brand hue for "primary" actions — that's the One-Blue Rule.
- **Don't** use hero-metric tiles, gradient body text, or tiny uppercase eyebrow labels stacked above every section — generic SaaS-dashboard grammar this system explicitly rejects.
- **Don't** add numbered-step scaffolding outside a genuine sequence — onboarding's 3-step grant flow earns it because it's a real ordered process, nothing else should copy the pattern by reflex.
- **Don't** apply `shadow-xl` to panels at rest inside the window app — that shadow is reserved for surfaces floating above other windows.
- **Don't** stack nested cards or repeat identical icon+heading+text card grids — not part of this system's vocabulary today, and shouldn't be introduced as a default.
