// PROTOTYPE — throwaway code for issue #65 (profile create/edit UI for new
// settings + session overrides). Three structurally different ways to expose
// Generation Options (target length, variant count, language, diacritics) in
// the profile form and let a single generation override them, switchable via
// `?variant=`. Mock state only — VoiceProfile.defaultGenerationOptions
// doesn't exist in the schema yet (ADR-0006 is decision-only, #60). Not wired
// into production; strip before merging.
import { useEffect, useState } from "react";

export const PROFILE_OPTIONS_VARIANTS = ["current", "A", "B", "C"] as const;
export type ProfileOptionsVariant = (typeof PROFILE_OPTIONS_VARIANTS)[number];

const LABELS: Record<ProfileOptionsVariant, string> = {
  current: "Current — name + description only",
  A: "A — Collapsible advanced section + per-field override pills",
  B: "B — Tabbed modal + single override drawer",
  C: "C — Always-visible fields, no disclosure, shared component",
};

export type MockOptions = {
  targetLength: number | null;
  variantCount: number;
  language: string;
  diacritics: "default" | "strip";
};

const DEFAULT_OPTIONS: MockOptions = { targetLength: null, variantCount: 1, language: "", diacritics: "default" };

function useMockOptions() {
  return useState<MockOptions>(DEFAULT_OPTIONS);
}

function OptionsGrid({
  value,
  onChange,
}: {
  value: MockOptions;
  onChange: (next: MockOptions) => void;
}) {
  return (
    <div className="proto-po__grid">
      <div>
        <label className="field-label">Target length (words)</label>
        <input
          type="number"
          min={1}
          placeholder="Any length"
          value={value.targetLength ?? ""}
          onChange={(e) => onChange({ ...value, targetLength: e.target.value ? Number(e.target.value) : null })}
        />
      </div>
      <div>
        <label className="field-label">Variants</label>
        <input
          type="number"
          min={1}
          max={6}
          value={value.variantCount}
          onChange={(e) => onChange({ ...value, variantCount: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })}
        />
      </div>
      <div>
        <label className="field-label">Output language</label>
        <input
          placeholder="Same as input"
          value={value.language}
          onChange={(e) => onChange({ ...value, language: e.target.value })}
        />
      </div>
      <div>
        <label className="field-label">Diacritics</label>
        <select value={value.diacritics} onChange={(e) => onChange({ ...value, diacritics: e.target.value as MockOptions["diacritics"] })}>
          <option value="default">Default</option>
          <option value="strip">Strip</option>
        </select>
      </div>
    </div>
  );
}

// A: profile form — collapsible "Advanced" disclosure, collapsed by default.
export function ProfileModalExtraA() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useMockOptions();
  return (
    <div className="proto-po__section">
      <button type="button" className="proto-po__disclosure" onClick={() => setOpen((v) => !v)}>
        {open ? "▾" : "▸"} Advanced generation settings
      </button>
      {open && <OptionsGrid value={options} onChange={setOptions} />}
    </div>
  );
}

// A: compose view — a compact pill row summarizing effective values; clicking
// a pill opens a tiny inline popover to override just that one field.
export function ComposeOverrideA() {
  const [options, setOptions] = useMockOptions();
  const [openField, setOpenField] = useState<keyof MockOptions | null>(null);

  const pills: { key: keyof MockOptions; label: string }[] = [
    { key: "variantCount", label: `${options.variantCount} variant${options.variantCount > 1 ? "s" : ""}` },
    { key: "targetLength", label: options.targetLength ? `${options.targetLength} words` : "Any length" },
    { key: "language", label: options.language || "Same language" },
    { key: "diacritics", label: options.diacritics === "strip" ? "No diacritics" : "Diacritics: default" },
  ];

  return (
    <div className="proto-po__pillrow">
      {pills.map((p) => (
        <div key={p.key} className="proto-po__pill-wrap">
          <button type="button" className="proto-po__pill" onClick={() => setOpenField(openField === p.key ? null : p.key)}>
            {p.label}
          </button>
          {openField === p.key && (
            <div className="proto-po__popover">
              <OptionsGrid value={options} onChange={setOptions} />
              <button type="button" className="btn-ghost" onClick={() => setOpenField(null)}>
                Done
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// B: profile form — a second tab, "Generation defaults", next to "Basics".
export function ProfileModalExtraB() {
  const [tab, setTab] = useState<"basics" | "defaults">("basics");
  const [options, setOptions] = useMockOptions();
  return (
    <div className="proto-po__section">
      <div className="view-toggle proto-po__tabs" role="group" aria-label="Profile section">
        <button className={`view-btn${tab === "basics" ? " active" : ""}`} onClick={() => setTab("basics")}>
          Basics
        </button>
        <button className={`view-btn${tab === "defaults" ? " active" : ""}`} onClick={() => setTab("defaults")}>
          Generation defaults
        </button>
      </div>
      {tab === "defaults" && <OptionsGrid value={options} onChange={setOptions} />}
    </div>
  );
}

// B: compose view — one toggle button opens a single drawer with all four
// fields pre-filled from the profile's defaults, plus a reset link.
export function ComposeOverrideB() {
  const [expanded, setExpanded] = useState(false);
  const [options, setOptions] = useMockOptions();
  const isCustomized = JSON.stringify(options) !== JSON.stringify(DEFAULT_OPTIONS);

  return (
    <div className="proto-po__drawer-wrap">
      <button type="button" className="proto-po__drawer-toggle" onClick={() => setExpanded((v) => !v)}>
        {expanded ? "▾" : "▸"} Adjust for this generation{isCustomized ? " · customized" : ""}
      </button>
      {expanded && (
        <div className="proto-po__drawer">
          <OptionsGrid value={options} onChange={setOptions} />
          <button type="button" className="btn-ghost" onClick={() => setOptions(DEFAULT_OPTIONS)}>
            Reset to profile defaults
          </button>
        </div>
      )}
    </div>
  );
}

// C: profile form — fields always visible, no expand/collapse at all.
export function ProfileModalExtraC() {
  const [options, setOptions] = useMockOptions();
  return (
    <div className="proto-po__section">
      <label className="field-label">Generation defaults</label>
      <OptionsGrid value={options} onChange={setOptions} />
    </div>
  );
}

// C: compose view — the same grid, always visible above the Run button, with
// a small badge showing whether it currently diverges from profile defaults.
export function ComposeOverrideC() {
  const [options, setOptions] = useMockOptions();
  const isCustomized = JSON.stringify(options) !== JSON.stringify(DEFAULT_OPTIONS);
  return (
    <div className="proto-po__flat">
      <div className="panel-label-row">
        <p className="panel-label" style={{ margin: 0 }}>
          Generation settings
        </p>
        {isCustomized && <span className="proto-po__badge">Customized</span>}
      </div>
      <OptionsGrid value={options} onChange={setOptions} />
    </div>
  );
}

export function ProfileModalExtraByVariant({ variant }: { variant: ProfileOptionsVariant }) {
  if (variant === "A") return <ProfileModalExtraA />;
  if (variant === "B") return <ProfileModalExtraB />;
  if (variant === "C") return <ProfileModalExtraC />;
  return null;
}

export function ComposeOverrideByVariant({ variant }: { variant: ProfileOptionsVariant }) {
  if (variant === "A") return <ComposeOverrideA />;
  if (variant === "B") return <ComposeOverrideB />;
  if (variant === "C") return <ComposeOverrideC />;
  return null;
}

export function useProfileOptionsVariant(): ProfileOptionsVariant {
  const fromUrl = new URLSearchParams(window.location.search).get("variant");
  return (PROFILE_OPTIONS_VARIANTS as readonly string[]).includes(fromUrl ?? "") ? (fromUrl as ProfileOptionsVariant) : "current";
}

export function ProfileOptionsSwitcher({ current }: { current: ProfileOptionsVariant }) {
  const index = PROFILE_OPTIONS_VARIANTS.indexOf(current);

  const go = (delta: number) => {
    const next = PROFILE_OPTIONS_VARIANTS[(index + delta + PROFILE_OPTIONS_VARIANTS.length) % PROFILE_OPTIONS_VARIANTS.length];
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
