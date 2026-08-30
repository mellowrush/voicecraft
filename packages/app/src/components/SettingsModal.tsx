import { useEffect, useRef, useState } from "react";
import { getApiKey, setApiKey } from "../lib/secretsClient";
import { vendorLabel, type Vendor } from "../lib/vendor";

type Props = {
  open: boolean;
  activeVendor: Vendor;
  onVendorChange: (vendor: Vendor) => void;
  onClose: () => void;
};

// Segmented toggle picks which vendor's key you're viewing/editing
// (`viewingVendor`, local) — it only becomes the vendor Voicecraft actually
// calls (`activeVendor`, owned by the caller) once that vendor is known to
// have a key, either because it already did or because Save just gave it
// one. Otherwise just browsing to check an unconfigured vendor's tab would
// silently break a working setup on the other vendor (issue #42, variant A).
export function SettingsModal({ open, activeVendor, onVendorChange, onClose }: Props) {
  const [viewingVendor, setViewingVendor] = useState<Vendor>(activeVendor);
  const [hasKey, setHasKey] = useState<Record<Vendor, boolean>>({ openai: false, anthropic: false });
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setViewingVendor(activeVendor);
  }, [open, activeVendor]);

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setError(null);
    setKey("");
    getApiKey(viewingVendor).then((existing) => {
      const configured = Boolean(existing);
      setHasKey((prev) => ({ ...prev, [viewingVendor]: configured }));
      if (configured && viewingVendor !== activeVendor) onVendorChange(viewingVendor);
    });
    keyInputRef.current?.focus();
    // onVendorChange/activeVendor intentionally excluded: this effect reacts
    // to the vendor tab changing, not to the parent's activeVendor updating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewingVendor]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function handleVendorChange(vendor: Vendor) {
    setViewingVendor(vendor);
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    if (!key.trim()) return;
    setError(null);
    try {
      await setApiKey(viewingVendor, key.trim());
      setHasKey((prev) => ({ ...prev, [viewingVendor]: true }));
      onVendorChange(viewingVendor);
      setKey("");
      setSaved(true);
    } catch {
      setError("Couldn't save the key to Keychain — try again.");
    }
  }

  return (
    <div
      className={`modal-overlay${open ? " show" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <h2 id="settings-modal-title">Settings</h2>
        <div className="mode-toggle" role="group" aria-label="AI Vendor" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`mode-btn${viewingVendor === "openai" ? " active" : ""}`}
            aria-pressed={viewingVendor === "openai"}
            onClick={() => handleVendorChange("openai")}
          >
            OpenAI
          </button>
          <button
            type="button"
            className={`mode-btn${viewingVendor === "anthropic" ? " active" : ""}`}
            aria-pressed={viewingVendor === "anthropic"}
            onClick={() => handleVendorChange("anthropic")}
          >
            Anthropic
          </button>
        </div>
        <label className="field-label" htmlFor="settings-api-key">
          {vendorLabel(viewingVendor)} API key
        </label>
        <input
          id="settings-api-key"
          type="password"
          ref={keyInputRef}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={
            hasKey[viewingVendor]
              ? "•••• configured — enter a new key to replace it"
              : `Enter your ${vendorLabel(viewingVendor)} API key`
          }
        />
        {saved && <p className="settings-saved">Saved to Keychain.</p>}
        {error && <p className="settings-error">{error}</p>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn-solid" disabled={!key.trim()} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
