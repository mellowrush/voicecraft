import type { GenerationOptions } from "@voicecraft/core";

type Props = {
  value: GenerationOptions;
  onChange: (next: GenerationOptions) => void;
};

// Shared by ProfileModal's "Generation defaults" tab and MainPanel's
// per-generation override drawer — a profile's defaults and a session
// override are the same GenerationOptions shape (map #58's decision), so
// they share the same editing UI.
export function GenerationOptionsFields({ value, onChange }: Props) {
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
          onChange={(e) => onChange({ ...value, language: e.target.value || undefined })}
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
          <option value="strip">Strip</option>
        </select>
      </div>
    </div>
  );
}
