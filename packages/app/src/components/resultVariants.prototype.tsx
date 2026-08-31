// PROTOTYPE — throwaway code for issue #59 (variant display UI).
// Three structurally different layouts for showing N generated variants in
// the compose view's result panel, switchable via `?variant=`. Mock data
// only — the real Engine doesn't return arrays yet (issue #61). Not wired
// into production; strip before merging.
import { useEffect, useState } from "react";

export const RESULT_VARIANTS = ["current", "A", "B", "C"] as const;
export type ResultVariant = (typeof RESULT_VARIANTS)[number];

const LABELS: Record<ResultVariant, string> = {
  current: "Current — single result panel",
  A: "A — Stacked cards",
  B: "B — Tabbed single view",
  C: "C — Side-by-side columns (drops the two-panel compose layout)",
};

export const MOCK_SCENARIOS = ["1", "3", "partial"] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

const MOCK_TEXT = [
  "Look, I've seen three of these \"revolutionary\" platforms this quarter alone. The revolution, it turns out, has excellent catering.",
  "When the intern called it a paradigm shift, I nearly choked on my martini. We called that a Tuesday in 1974.",
  "Sixty years from now someone will frame this meeting as a turning point. History is just nostalgia with a budget.",
  "The kids call it disruption. I call it Tuesday with better lighting and worse manners.",
];

function mockData(scenario: MockScenario): { requested: number; texts: string[] } {
  if (scenario === "1") return { requested: 1, texts: MOCK_TEXT.slice(0, 1) };
  if (scenario === "3") return { requested: 3, texts: MOCK_TEXT.slice(0, 3) };
  return { requested: 4, texts: MOCK_TEXT.slice(0, 2) }; // partial success: asked 4, got 2
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button className="copy-btn" title={label} aria-label={label} onClick={() => void navigator.clipboard.writeText(text)}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M4 13V5a2 2 0 0 1 2-2h8" />
      </svg>
    </button>
  );
}

function PartialNotice({ requested, got }: { requested: number; got: number }) {
  if (got >= requested) return null;
  return (
    <p className="proto-rv__partial">
      Generated {got} of {requested} requested variants.
    </p>
  );
}

// A: vertical stack of cards inside the existing single result-box — each
// card carries its own header (index + copy) and body. Missing slots don't
// render a card at all; the shortfall shows as one notice below the stack.
function VariantAStack({ scenario }: { scenario: MockScenario }) {
  const { requested, texts } = mockData(scenario);
  return (
    <div className="panel">
      <p className="panel-label" style={{ margin: 0 }}>
        Result
      </p>
      <div className="result-box proto-rv__stack">
        {texts.map((text, i) => (
          <div className="proto-rv__card" key={i}>
            <div className="proto-rv__card-head">
              <span>Variant {i + 1}</span>
              <CopyButton text={text} label={`Copy variant ${i + 1}`} />
            </div>
            <p className="result-plain">{text}</p>
          </div>
        ))}
        <PartialNotice requested={requested} got={texts.length} />
      </div>
    </div>
  );
}

// B: one variant visible at a time, switched via a pill tab row reusing the
// existing view-toggle visual language. A missing requested slot renders as
// a disabled ghost tab so the shortfall is visible without extra copy.
function VariantBTabs({ scenario }: { scenario: MockScenario }) {
  const { requested, texts } = mockData(scenario);
  const [active, setActive] = useState(0);
  const activeText = texts[active] ?? "";

  return (
    <div className="panel">
      <div className="panel-label-row">
        <p className="panel-label" style={{ margin: 0 }}>
          Result
        </p>
        <div className="toolbar-right">
          <div className="view-toggle" role="group" aria-label="Variant">
            {Array.from({ length: requested }, (_, i) => {
              const missing = i >= texts.length;
              return (
                <button
                  key={i}
                  className={`view-btn${active === i ? " active" : ""}`}
                  disabled={missing}
                  title={missing ? "Not generated" : `Variant ${i + 1}`}
                  onClick={() => setActive(i)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <CopyButton text={activeText} label="Copy this variant" />
        </div>
      </div>
      <div className="result-box">
        <p className="result-plain">{activeText}</p>
      </div>
    </div>
  );
}

// C: drops the two-panel "Original text | Result" compose layout entirely.
// Original text collapses to a compact strip on top; N result columns run
// side by side below, each independently scrollable and copyable. Missing
// slots render as dashed empty columns instead of a text notice.
function VariantCColumns({ scenario, originalText }: { scenario: MockScenario; originalText: string }) {
  const { requested, texts } = mockData(scenario);
  return (
    <div className="proto-rv__c-root">
      <div className="proto-rv__c-original">
        <p className="panel-label" style={{ margin: 0 }}>
          Original text
        </p>
        <p className="proto-rv__c-original-text">{originalText}</p>
      </div>
      <p className="panel-label" style={{ margin: "12px 0 6px" }}>
        Results
      </p>
      <div className="proto-rv__c-columns">
        {Array.from({ length: requested }, (_, i) => {
          const text = texts[i];
          if (text === undefined) {
            return (
              <div className="proto-rv__c-col proto-rv__c-col--empty" key={i}>
                <span>Not generated</span>
              </div>
            );
          }
          return (
            <div className="proto-rv__c-col" key={i}>
              <div className="proto-rv__card-head">
                <span>Variant {i + 1}</span>
                <CopyButton text={text} label={`Copy variant ${i + 1}`} />
              </div>
              <p className="result-plain">{text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResultVariantsByKey({
  variant,
  scenario,
  originalText,
}: {
  variant: ResultVariant;
  scenario: MockScenario;
  originalText: string;
}) {
  if (variant === "A") return <VariantAStack scenario={scenario} />;
  if (variant === "B") return <VariantBTabs scenario={scenario} />;
  if (variant === "C") return <VariantCColumns scenario={scenario} originalText={originalText} />;
  return null; // "current" — caller renders the real production panel instead
}

export function useResultVariant(): ResultVariant {
  const fromUrl = new URLSearchParams(window.location.search).get("variant");
  return (RESULT_VARIANTS as readonly string[]).includes(fromUrl ?? "") ? (fromUrl as ResultVariant) : "current";
}

export function useMockScenario(): MockScenario {
  const fromUrl = new URLSearchParams(window.location.search).get("count");
  return (MOCK_SCENARIOS as readonly string[]).includes(fromUrl ?? "") ? (fromUrl as MockScenario) : "partial";
}

export function ResultVariantSwitcher({ current }: { current: ResultVariant }) {
  const index = RESULT_VARIANTS.indexOf(current);

  const go = (delta: number) => {
    const next = RESULT_VARIANTS[(index + delta + RESULT_VARIANTS.length) % RESULT_VARIANTS.length];
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
    <div className="proto-switcher proto-rv__switcher">
      <button onClick={() => go(-1)} aria-label="Previous variant">←</button>
      <span>
        {LABELS[current]} · try <code>?count=1|3|partial</code>
      </span>
      <button onClick={() => go(1)} aria-label="Next variant">→</button>
    </div>
  );
}
