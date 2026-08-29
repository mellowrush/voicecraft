# Product

## Register

product

## Users

A single user (the developer) running Voicecraft locally on their own Mac. No accounts, no multi-tenant concerns. Used ad hoc throughout the day, interleaved with other apps: select text anywhere, hit ⌥ Space, get a rewritten/generated result back in place. The window app is the secondary surface (profile management, longer compose sessions); the HUD and hotkey flow are the primary daily-use path.

## Product Purpose

Voicecraft rewrites or generates text into a chosen "voice" (a reusable profile of tone/style/constraints), invoked either from the window app (compose UI) or system-wide via a global hotkey + floating HUD. Success is near-invisible: minimal friction between "select text" and "get it back in the right voice," with the app otherwise staying out of the way.

## Brand Personality

Precise, calm, trustworthy. Copy is direct and matter-of-fact (e.g. the Accessibility-permission explanation states plainly what the permission does and that text never leaves the device except to the configured AI provider). No marketing voice, no hype — this is a tool, and it should read like one a careful engineer built for themselves.

## Anti-references

Generic SaaS dashboard tropes: hero-metric tiles, gradient text, tiny uppercase eyebrow labels stacked above every section, numbered-step scaffolding for its own sake, identical icon+heading+text card grids. Voicecraft already reaches for a mono section label sparingly and for one deliberate numbered onboarding sequence (issue #21 flow) — that's fine because it's real sequence, not reflexive decoration; don't add more of that pattern elsewhere.

## Design Principles

1. **Stay out of the way.** This is a tool invoked mid-task in other apps; the HUD/hotkey path should feel instantaneous and unobtrusive, not like a destination.
2. **Say exactly what's happening.** Status, permissions, and errors are stated plainly (see onboarding copy) — no vague reassurance, no marketing softening.
3. **One voice, three surfaces.** Window app, HUD, and onboarding share one token system (Reworkd design system — cobalt CTA, lavender-mist surfaces, gradient wordmark) rather than each screen inventing its own look.
4. **Calm over flashy.** Precise and trustworthy beats playful or bold; motion and color should read as considered, not decorative.
5. **Personal-scale, not enterprise-scale.** No multi-user chrome, no settings sprawl, no empty-state onboarding funnels built for a general audience — this app is built for one user's daily workflow.

## Accessibility & Inclusion

No explicit WCAG target set; treat WCAG AA (4.5:1 body text contrast, 3:1 large text/UI) as the floor given this is a text-editing tool used for extended sessions. Respect `prefers-reduced-motion` for HUD/toast/modal transitions. No other known accessibility requirements beyond that.
