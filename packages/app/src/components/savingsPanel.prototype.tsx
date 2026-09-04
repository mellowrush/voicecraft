// PROTOTYPE — throwaway code for issue #90 (savings/stats panel UI). Three
// structurally different visual treatments of the same agreed content (hero
// cumulative stats, dedupe hit rate, per-mechanism breakdown, empty state),
// switchable via `?variant=`. Mock data only — the real `savedUsage` field
// on HistoryEntry and the pricing table (#94) don't exist yet. Not wired
// into production; strip before merging.
import { useEffect, useState } from "react";

export const SAVINGS_VARIANTS = ["current", "A", "B", "C"] as const;
export type SavingsUIVariant = (typeof SAVINGS_VARIANTS)[number];

const LABELS: Record<SavingsUIVariant, string> = {
  current: "Current — no savings tab",
  A: "A — Dashboard cards + bar breakdown",
  B: "B — Hero hit-rate ring, centerpiece",
  C: "C — Minimal ledger, receipt-style",
};

// Mirrors #94's schema decision: usage is raw tokens, dedupeHit/compressed
// are independent flags, savedUsage is only present on a dedupe hit (the
// tokens that specific call *would* have cost).
type MockEntry = {
  dedupeHit: boolean;
  compressed: boolean;
  usage: { inputTokens: number; outputTokens: number };
  savedUsage?: { inputTokens: number; outputTokens: number };
};

const MOCK_HISTORY: MockEntry[] = [
  { dedupeHit: false, compressed: false, usage: { inputTokens: 420, outputTokens: 180 } },
  { dedupeHit: true, compressed: false, usage: { inputTokens: 0, outputTokens: 0 }, savedUsage: { inputTokens: 420, outputTokens: 180 } },
  { dedupeHit: false, compressed: true, usage: { inputTokens: 310, outputTokens: 165 } },
  { dedupeHit: false, compressed: false, usage: { inputTokens: 505, outputTokens: 210 } },
  { dedupeHit: true, compressed: false, usage: { inputTokens: 0, outputTokens: 0 }, savedUsage: { inputTokens: 505, outputTokens: 210 } },
  { dedupeHit: true, compressed: false, usage: { inputTokens: 0, outputTokens: 0 }, savedUsage: { inputTokens: 310, outputTokens: 165 } },
  { dedupeHit: false, compressed: true, usage: { inputTokens: 298, outputTokens: 140 } },
  { dedupeHit: false, compressed: false, usage: { inputTokens: 388, outputTokens: 175 } },
];

// $/1M tokens — placeholder pricing table shape per #94 (gpt-4o-mini rates).
const PRICE = { input: 0.15, output: 0.6 };
const dollarsFor = (t: { inputTokens: number; outputTokens: number }) =>
  (t.inputTokens / 1_000_000) * PRICE.input + (t.outputTokens / 1_000_000) * PRICE.output;

function useSavingsStats(entries: MockEntry[]) {
  const dedupeHits = entries.filter((e) => e.dedupeHit);
  const compressedCalls = entries.filter((e) => e.compressed);
  const totalCalls = entries.length;
  const savedTokens = dedupeHits.reduce(
    (sum, e) => sum + (e.savedUsage ? e.savedUsage.inputTokens + e.savedUsage.outputTokens : 0),
    0,
  );
  const savedDollars = dedupeHits.reduce((sum, e) => sum + (e.savedUsage ? dollarsFor(e.savedUsage) : 0), 0);
  const hitRate = totalCalls ? dedupeHits.length / totalCalls : 0;
  return {
    savedTokens,
    savedDollars,
    hitRate,
    dedupeHitCount: dedupeHits.length,
    compressedCount: compressedCalls.length,
    totalCalls,
  };
}

function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}
function fmtDollars(n: number) {
  return `$${n.toFixed(4)}`;
}

function EmptyState() {
  return (
    <div className="savings-empty">
      <div className="savings-empty-icon" aria-hidden="true">
        ⚡
      </div>
      <p className="savings-empty-title">No savings yet</p>
      <p className="savings-empty-body">Start generating — repeats, compression, and vendor caching will show up here.</p>
    </div>
  );
}

// A — dashboard: three hero cards up top, then a horizontal-bar breakdown
// per mechanism (dedupe hard numbers, compression as a labelled cohort
// estimate, vendor caching shown dormant per #89's research finding).
export function SavingsPanelA({ entries }: { entries: MockEntry[] }) {
  const s = useSavingsStats(entries);
  if (!entries.length) return <EmptyState />;

  return (
    <div className="savings-panel savings-a">
      <div className="savings-hero-row">
        <div className="savings-hero-card">
          <p className="savings-hero-label">Tokens saved</p>
          <p className="savings-hero-value">{fmtTokens(s.savedTokens)}</p>
        </div>
        <div className="savings-hero-card">
          <p className="savings-hero-label">Saved</p>
          <p className="savings-hero-value">{fmtDollars(s.savedDollars)}</p>
        </div>
        <div className="savings-hero-card">
          <p className="savings-hero-label">Hit rate</p>
          <p className="savings-hero-value">{Math.round(s.hitRate * 100)}%</p>
        </div>
      </div>

      <div className="savings-breakdown">
        <div className="savings-bar-row">
          <span className="savings-bar-label">Dedupe cache</span>
          <div className="savings-bar-track">
            <div className="savings-bar-fill savings-bar-dedupe" style={{ width: `${s.hitRate * 100}%` }} />
          </div>
          <span className="savings-bar-value">
            {s.dedupeHitCount}/{s.totalCalls} calls
          </span>
        </div>
        <div className="savings-bar-row">
          <span className="savings-bar-label">Compression</span>
          <div className="savings-bar-track">
            <div className="savings-bar-fill savings-bar-compress" style={{ width: "38%" }} />
          </div>
          <span className="savings-bar-value">~12% smaller (est.)</span>
        </div>
        <div className="savings-bar-row savings-bar-dormant">
          <span className="savings-bar-label">Vendor caching</span>
          <div className="savings-bar-track">
            <div className="savings-bar-fill savings-bar-off" style={{ width: "0%" }} />
          </div>
          <span className="savings-bar-value">Dormant — profiles too short</span>
        </div>
      </div>
    </div>
  );
}

// B — hero ring: a big SVG ring is the focal point (hit rate), tokens/$
// flank it, mechanism breakdown is a compact list beneath.
export function SavingsPanelB({ entries }: { entries: MockEntry[] }) {
  const s = useSavingsStats(entries);
  if (!entries.length) return <EmptyState />;

  const pct = s.hitRate * 100;
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="savings-panel savings-b">
      <div className="savings-ring-row">
        <div className="savings-flank">
          <p className="savings-flank-value">{fmtTokens(s.savedTokens)}</p>
          <p className="savings-flank-label">tokens saved</p>
        </div>

        <div className="savings-ring-wrap">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={r} className="savings-ring-track" />
            <circle
              cx="70"
              cy="70"
              r={r}
              className="savings-ring-fill"
              strokeDasharray={c}
              strokeDashoffset={offset}
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div className="savings-ring-center">
            <p className="savings-ring-pct">{Math.round(pct)}%</p>
            <p className="savings-ring-sub">hit rate</p>
          </div>
        </div>

        <div className="savings-flank">
          <p className="savings-flank-value">{fmtDollars(s.savedDollars)}</p>
          <p className="savings-flank-label">saved</p>
        </div>
      </div>

      <ul className="savings-list">
        <li>
          <span>Dedupe cache</span>
          <span>
            {s.dedupeHitCount}/{s.totalCalls} calls
          </span>
        </li>
        <li>
          <span>Compression</span>
          <span>~12% smaller (est.)</span>
        </li>
        <li className="savings-list-dormant">
          <span>Vendor caching</span>
          <span>Dormant — profiles too short</span>
        </li>
      </ul>
    </div>
  );
}

// C — minimal ledger: understated, numbers-forward, receipt-style rows.
export function SavingsPanelC({ entries }: { entries: MockEntry[] }) {
  const s = useSavingsStats(entries);
  if (!entries.length) return <EmptyState />;

  return (
    <div className="savings-panel savings-c">
      <div className="savings-ledger-total">
        <p className="savings-ledger-total-value">{fmtDollars(s.savedDollars)}</p>
        <p className="savings-ledger-total-label">saved so far · {fmtTokens(s.savedTokens)} tokens</p>
      </div>
      <div className="savings-ledger">
        <div className="savings-ledger-row">
          <span>Dedupe cache hit rate</span>
          <span className="savings-ledger-num">{Math.round(s.hitRate * 100)}%</span>
        </div>
        <div className="savings-ledger-row">
          <span>Dedupe hits</span>
          <span className="savings-ledger-num">
            {s.dedupeHitCount} / {s.totalCalls}
          </span>
        </div>
        <div className="savings-ledger-row">
          <span>Compression (est.)</span>
          <span className="savings-ledger-num">~12% smaller</span>
        </div>
        <div className="savings-ledger-row savings-ledger-dormant">
          <span>Vendor caching</span>
          <span className="savings-ledger-num">Dormant</span>
        </div>
      </div>
    </div>
  );
}

export function useSavingsUIVariant(): SavingsUIVariant {
  const fromUrl = new URLSearchParams(window.location.search).get("variant");
  return (SAVINGS_VARIANTS as readonly string[]).includes(fromUrl ?? "") ? (fromUrl as SavingsUIVariant) : "current";
}

export function SavingsVariantSwitcher({
  current,
  entries,
  onToggleEmpty,
}: {
  current: SavingsUIVariant;
  entries: MockEntry[];
  onToggleEmpty: () => void;
}) {
  const index = SAVINGS_VARIANTS.indexOf(current);

  const go = (delta: number) => {
    const next = SAVINGS_VARIANTS[(index + delta + SAVINGS_VARIANTS.length) % SAVINGS_VARIANTS.length];
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
      <button onClick={() => go(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>{LABELS[current]}</span>
      <button onClick={() => go(1)} aria-label="Next variant">
        →
      </button>
      <button onClick={onToggleEmpty} className="proto-switcher-empty-toggle">
        {entries.length ? "Simulate empty" : "Simulate populated"}
      </button>
    </div>
  );
}

export function useMockSavingsEntries() {
  const [empty, setEmpty] = useState(false);
  return { entries: empty ? [] : MOCK_HISTORY, toggleEmpty: () => setEmpty((v) => !v) };
}
