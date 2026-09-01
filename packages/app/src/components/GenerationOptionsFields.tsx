import { canSafelyStripDiacritics, type GenerationOptions } from "@voicecraft/core";

type Props = {
  value: GenerationOptions;
  onChange: (next: GenerationOptions) => void;
};

// Shared by ProfileModal's "Generation defaults" tab and MainPanel's
// per-generation override drawer — a profile's defaults and a session
// override are the same GenerationOptions shape (map #58's decision), so
// they share the same editing UI.
export function GenerationOptionsFields({ value, onChange }: Props) {
  const canStrip = canSafelyStripDiacritics(value.language);
  return (
    <div className="options-grid">
      <div>
        <label className="field-label" htmlFor="options-target-length">
          Target length (words)
        </label>
        <input
          id="options-target-length"
          type="number"
          min={1}
          placeholder="Any length"
          value={value.targetLength ?? ""}
          onChange={(e) =>
            onChange({ ...value, targetLength: e.target.value ? Number(e.target.value) : undefined })
          }
        />
      </div>
      <div>
        <label className="field-label" htmlFor="options-variant-count">
          Variants
        </label>
        <input
          id="options-variant-count"
          type="number"
          min={1}
          max={6}
          value={value.variantCount ?? 1}
          onChange={(e) =>
            onChange({ ...value, variantCount: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })
          }
        />
      </div>
      <div>
        <label className="field-label" htmlFor="options-language">
          Output language
        </label>
        <input
          id="options-language"
          placeholder="Same as input"
          value={value.language ?? ""}
          onChange={(e) => {
            const language = e.target.value || undefined;
            // If diacritics was set to "strip" for a language that no longer
            // supports it, clear it rather than leaving a disabled selection
            // silently in effect.
            const diacritics = value.diacritics === "strip" && !canSafelyStripDiacritics(language)
              ? undefined
              : value.diacritics;
            onChange({ ...value, language, diacritics });
          }}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="options-diacritics">
          Diacritics
        </label>
        <select
          id="options-diacritics"
          value={value.diacritics ?? "default"}
          onChange={(e) => onChange({ ...value, diacritics: e.target.value as GenerationOptions["diacritics"] })}
        >
          <option value="default">Default</option>
          <option value="strip" disabled={!canStrip}>
            Strip{canStrip ? "" : " (unavailable for this language)"}
          </option>
        </select>
      </div>
    </div>
  );
}
