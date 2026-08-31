// PROTOTYPE — throwaway code for issue #44 (logo/wordmark design).
// Three structurally different marks for the sidebar header, switchable via
// `?variant=`. Not wired into production; strip before merging.
import { useEffect } from "react";

export const LOGO_VARIANTS = ["current", "A", "B", "C", "D"] as const;
export type LogoVariant = (typeof LOGO_VARIANTS)[number];

const LABELS: Record<LogoVariant, string> = {
  current: "Current — chevron + gradient serif",
  A: "A — Quill stroke",
  B: "B — Merged monogram",
  C: "C — Instrument dial badge",
  D: "D — Open dial arc + signature-stroke V (more B in C)",
};

// Current: plain chevron icon + gradient serif wordmark text (baseline, unchanged).
export function LogoMarkCurrent() {
  return (
    <span className="wordmark">
      <svg className="mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M6 8 L20 32 L34 8" stroke="url(#mark-grad-current)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <defs>
          <linearGradient id="mark-grad-current" x1="0" y1="0" x2="0" y2="40">
            <stop offset="0" stopColor="#5897f7" />
            <stop offset="1" stopColor="#3872e6" />
          </linearGradient>
        </defs>
      </svg>
      Voicecraft
    </span>
  );
}

// A: chevron reworked into a single tapered ink-stroke, calligraphic "V" — the
// hand-signature reading of the current serif wordmark carried into the mark itself.
export function LogoMarkA() {
  return (
    <span className="wordmark">
      <svg className="mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M5 7 C5 7 12 26 19.5 33 C20.5 34 21 33.5 21.5 32.5 C27 22 30 14 35 6"
          stroke="url(#mark-grad-a)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <defs>
          <linearGradient id="mark-grad-a" x1="0" y1="0" x2="40" y2="40">
            <stop offset="0" stopColor="#5897f7" />
            <stop offset="0.6" stopColor="#3872e6" />
            <stop offset="1" stopColor="#2c65d3" />
          </linearGradient>
        </defs>
      </svg>
      Voicecraft
    </span>
  );
}

// B: no separate icon — the wordmark's own leading "V" is enlarged and given the
// gradient nib treatment, the rest of the word stays plain ink serif.
export function LogoMarkB() {
  return (
    <span className="wordmark proto-mark-b">
      <span className="proto-mark-b__v" aria-hidden="true">V</span>
      <span className="proto-mark-b__rest">oicecraft</span>
    </span>
  );
}

// C: circular cobalt "instrument dial" badge carries the expressive weight;
// wordmark text drops to plain sans/mono, no gradient on the text itself.
export function LogoMarkC() {
  return (
    <span className="wordmark proto-mark-c">
      <svg className="proto-mark-c__badge" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="url(#mark-grad-c)" />
        <path d="M9 17 L13 11 L17 20 L21 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <defs>
          <linearGradient id="mark-grad-c" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0" stopColor="#3872e6" />
            <stop offset="1" stopColor="#2c65d3" />
          </linearGradient>
        </defs>
      </svg>
      <span className="proto-mark-c__text">Voicecraft</span>
    </span>
  );
}

// D v4 (overdrive): the ring stops being decoration and becomes the live status
// indicator — while a rewrite request is in flight, the dial's open gap oscillates
// like a gauge needle finding its reading, and the ring's color steps from cobalt
// to iris-blue (the same "system is listening" accent used for HUD/focus states).
// The V signature stroke is left untouched: DESIGN.md reserves exactly one
// deliberately expressive mark, and this keeps it as the only one.
export function LogoMarkD({ isProcessing = false }: { isProcessing?: boolean }) {
  return (
    <span className="wordmark proto-mark-d">
      <svg className="proto-mark-d__badge" viewBox="0 0 28 28" aria-hidden="true">
        <g className={`proto-mark-d__ring${isProcessing ? " is-processing" : ""}`}>
          <path d="M20 3.6 A12 12 0 1 1 8 3.6" fill="none" strokeWidth="1.4" strokeLinecap="round" />
        </g>
        <path d="M9 9 L14 20 L19 9" stroke="url(#mark-grad-d)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <defs>
          <linearGradient id="mark-grad-d" x1="0" y1="9" x2="0" y2="20">
            <stop offset="0" stopColor="#5897f7" />
            <stop offset="1" stopColor="#3872e6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="proto-mark-b__rest">oicecraft</span>
    </span>
  );
}

export function LogoMarkByVariant({ variant, isProcessing }: { variant: LogoVariant; isProcessing?: boolean }) {
  if (variant === "A") return <LogoMarkA />;
  if (variant === "B") return <LogoMarkB />;
  if (variant === "C") return <LogoMarkC />;
  if (variant === "D") return <LogoMarkD isProcessing={isProcessing} />;
  return <LogoMarkCurrent />;
}

export function useLogoVariant(): LogoVariant {
  const fromUrl = new URLSearchParams(window.location.search).get("variant");
  return (LOGO_VARIANTS as readonly string[]).includes(fromUrl ?? "") ? (fromUrl as LogoVariant) : "current";
}

export function LogoVariantSwitcher({ current }: { current: LogoVariant }) {
  const index = LOGO_VARIANTS.indexOf(current);

  const go = (delta: number) => {
    const next = LOGO_VARIANTS[(index + delta + LOGO_VARIANTS.length) % LOGO_VARIANTS.length];
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.location.href = url.toString();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="proto-switcher">
      <button onClick={() => go(-1)} aria-label="Previous variant">←</button>
      <span>{LABELS[current]}</span>
      <button onClick={() => go(1)} aria-label="Next variant">→</button>
    </div>
  );
}
