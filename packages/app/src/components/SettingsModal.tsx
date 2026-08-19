import { useEffect, useState } from "react";
import { getApiKey, setApiKey } from "../lib/secretsClient";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: Props) {
  const [hasKey, setHasKey] = useState(false);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setError(null);
    setKey("");
    getApiKey().then((existing) => setHasKey(Boolean(existing)));
  }, [open]);

  async function handleSave() {
    if (!key.trim()) return;
    setError(null);
    try {
      await setApiKey(key.trim());
      setHasKey(true);
      setKey("");
      setSaved(true);
    } catch {
      setError("Couldn't save the key to Keychain — try again.");
    }
  }

  return (
    <div className={`modal-overlay${open ? " show" : ""}`}>
      <div className="modal">
        <h2>Settings</h2>
        <label className="field-label">API key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={hasKey ? "•••• configured — enter a new key to replace it" : "Enter your provider API key"}
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
