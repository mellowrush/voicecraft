// PROTOTYPE — throwaway code for issue #82 (micro-interaction/motion character).
// Three motion vocabularies applied to the same cluster of real controls
// (primary button, ghost button, history-style card row, loading button),
// switchable via `?motion=`. Not wired into production; strip before merging.
import { useEffect, useState } from "react";

export const MOTION_VARIANTS = ["A", "B", "C"] as const;
export type MotionVariant = (typeof MOTION_VARIANTS)[number];

const LABELS: Record<MotionVariant, string> = {
  A: "A — Mechanical snap (instant press, stepped loading tick)",
  B: "B — Soft ease (refined version of today's feel)",
  C: "C — Ink-stroke reveal (spring overshoot, gauge-needle loading)",
};

function DemoCluster({ variant }: { variant: MotionVariant }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const simulateRun = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2200);
  };

  return (
    <div className={`proto-motion proto-motion--${variant}`}>
      <div className="proto-motion__row">
        <button type="button" className="proto-motion__btn-primary" onClick={simulateRun} disabled={loading}>
          {loading && <span className="proto-motion__spinner" aria-hidden="true" />}
          {loading ? "Generating…" : "Run"}
        </button>
        <button type="button" className="proto-motion__btn-ghost">
          Cancel
        </button>
        <input className="proto-motion__input" placeholder="Focus me" />
      </div>

      <div className="proto-motion__card" onClick={() => setExpanded((e) => !e)}>
        <div className="proto-motion__card-head">
          <span>Rewrite — Formal</span>
          <span className="proto-motion__card-time">2:14 PM</span>
        </div>
        {expanded && <div className="proto-motion__card-body">Expanded body content revealed here.</div>}
      </div>
    </div>
  );
}

export function MotionVariantByKey({ variant }: { variant: MotionVariant }) {
  return <DemoCluster variant={variant} />;
}

export function useMotionVariant(): MotionVariant {
  const fromUrl = new URLSearchParams(window.location.search).get("motion");
  return (MOTION_VARIANTS as readonly string[]).includes(fromUrl ?? "") ? (fromUrl as MotionVariant) : "A";
}

export function MotionVariantSwitcher({ current }: { current: MotionVariant }) {
  const index = MOTION_VARIANTS.indexOf(current);

  const go = (delta: number) => {
    const next = MOTION_VARIANTS[(index + delta + MOTION_VARIANTS.length) % MOTION_VARIANTS.length];
    const url = new URL(window.location.href);
    url.searchParams.set("motion", next);
    window.location.href = url.toString();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "[") go(-1);
      if (e.key === "]") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="proto-motion-switcher">
      <button onClick={() => go(-1)} aria-label="Previous motion variant">←</button>
      <span>{LABELS[current]}</span>
      <button onClick={() => go(1)} aria-label="Next motion variant">→</button>
    </div>
  );
}
