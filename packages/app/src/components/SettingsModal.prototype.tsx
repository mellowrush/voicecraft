// PROTOTYPE — throwaway, answers "what should AI Vendor selection look like
// in Settings?" for issue #42. Three variants of the same modal, switchable
// via `?variant=A|B|C`. Mounted instead of the real SettingsModal only when
// `import.meta.env.DEV` and a `variant` param is present — see App.tsx.
//
// No real backend exists yet for per-vendor keys (get_api_key/set_api_key
// take no vendor today), so all "save" actions here are faked in memory.
// Nothing in this file should be promoted as-is — fold the winning layout
// into a rewritten SettingsModal.tsx and delete this file.
import { useEffect, useState } from "react";

type Vendor = "openai" | "anthropic";

function vendorLabel(v: Vendor): string {
  return v === "openai" ? "OpenAI" : "Anthropic";
}

function fakeDelay() {
  return new Promise((resolve) => setTimeout(resolve, 300));
}

type ModalProps = { onClose: () => void };

// --- Variant A — segmented toggle (pill control), single key field ---------

function VariantA({ onClose }: ModalProps) {
  const [vendor, setVendor] = useState<Vendor>("openai");
  const [configured, setConfigured] = useState<Record<Vendor, boolean>>({ openai: true, anthropic: false });
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedFor, setSavedFor] = useState<Vendor | null>(null);

  async function handleSave() {
    if (!key.trim()) return;
    setBusy(true);
    await fakeDelay();
    setBusy(false);
    setConfigured((c) => ({ ...c, [vendor]: true }));
    setKey("");
    setSavedFor(vendor);
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="proto-a-title">
      <h2 id="proto-a-title">Settings</h2>
      <div className="mode-toggle" role="group" aria-label="AI Vendor" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`mode-btn${vendor === "openai" ? " active" : ""}`}
          aria-pressed={vendor === "openai"}
          onClick={() => {
            setVendor("openai");
            setSavedFor(null);
          }}
        >
          OpenAI
        </button>
        <button
          type="button"
          className={`mode-btn${vendor === "anthropic" ? " active" : ""}`}
          aria-pressed={vendor === "anthropic"}
          onClick={() => {
            setVendor("anthropic");
            setSavedFor(null);
          }}
        >
          Anthropic
        </button>
      </div>
      <label className="field-label" htmlFor="proto-a-key">
        {vendorLabel(vendor)} API key
      </label>
      <input
        id="proto-a-key"
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={
          configured[vendor] ? "•••• configured — enter a new key to replace it" : `Enter your ${vendorLabel(vendor)} API key`
        }
      />
      {savedFor === vendor && <p className="settings-saved">Saved to Keychain.</p>}
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>
          Close
        </button>
        <button className="btn-solid" disabled={!key.trim() || busy} onClick={() => void handleSave()}>
          Save
        </button>
      </div>
    </div>
  );
}

// --- Variant B — manage both vendors as an independent list, pick a default -

function VariantB({ onClose }: ModalProps) {
  const vendors: Vendor[] = ["openai", "anthropic"];
  const [keys, setKeys] = useState<Record<Vendor, string>>({ openai: "", anthropic: "" });
  const [configured, setConfigured] = useState<Record<Vendor, boolean>>({ openai: true, anthropic: false });
  const [defaultVendor, setDefaultVendor] = useState<Vendor>("openai");
  const [busyVendor, setBusyVendor] = useState<Vendor | null>(null);

  async function handleSave(v: Vendor) {
    if (!keys[v].trim()) return;
    setBusyVendor(v);
    await fakeDelay();
    setBusyVendor(null);
    setConfigured((c) => ({ ...c, [v]: true }));
    setKeys((k) => ({ ...k, [v]: "" }));
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="proto-b-title">
      <h2 id="proto-b-title">Settings</h2>
      {vendors.map((v) => (
        <div key={v} style={{ marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--color-pale-slate)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="field-label" style={{ marginBottom: 0 }}>
              {vendorLabel(v)}
            </span>
            <span className={`status-pill${configured[v] ? " granted" : ""}`} style={{ marginBottom: 0 }}>
              <span className="dot" aria-hidden="true" />
              <span>{configured[v] ? "Configured" : "Not configured"}</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              aria-label={`${vendorLabel(v)} API key`}
              value={keys[v]}
              onChange={(e) => setKeys((k) => ({ ...k, [v]: e.target.value }))}
              placeholder={configured[v] ? "•••• enter a new key to replace it" : `Enter your ${vendorLabel(v)} API key`}
              style={{ marginBottom: 0, flex: 1 }}
            />
            <button
              type="button"
              className="btn-solid"
              disabled={!keys[v].trim() || busyVendor === v}
              onClick={() => void handleSave(v)}
            >
              Save
            </button>
          </div>
        </div>
      ))}
      <label className="field-label" htmlFor="proto-b-default">
        Use for new requests
      </label>
      <select
        id="proto-b-default"
        value={defaultVendor}
        onChange={(e) => setDefaultVendor(e.target.value as Vendor)}
        style={{
          width: "100%",
          marginBottom: 14,
          padding: "9px 12px",
          border: "1px solid var(--color-pale-slate)",
          borderRadius: "var(--radius-md)",
          fontSize: 14,
        }}
      >
        {vendors.map((v) => (
          <option key={v} value={v} disabled={!configured[v]}>
            {vendorLabel(v)}
            {!configured[v] ? " (not configured)" : ""}
          </option>
        ))}
      </select>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

// --- Variant C — no explicit selector, vendor inferred from key format -----

function detectVendor(key: string): Vendor | null {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

function VariantC({ onClose }: ModalProps) {
  const [key, setKey] = useState("");
  const [savedVendor, setSavedVendor] = useState<Vendor | null>("openai");
  const [overrideVendor, setOverrideVendor] = useState<Vendor | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const detected = detectVendor(key);
  const effectiveVendor = overrideVendor ?? detected;

  async function handleSave() {
    if (!key.trim() || !effectiveVendor) return;
    setBusy(true);
    await fakeDelay();
    setBusy(false);
    setSavedVendor(effectiveVendor);
    setKey("");
    setOverrideVendor(null);
    setSaved(true);
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="proto-c-title">
      <h2 id="proto-c-title">Settings</h2>
      <label className="field-label" htmlFor="proto-c-key">
        API key
      </label>
      <input
        id="proto-c-key"
        type="password"
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          setSaved(false);
          setOverrideVendor(null);
        }}
        placeholder={
          savedVendor
            ? `•••• ${vendorLabel(savedVendor)} configured — paste a new key to replace it`
            : "Paste your OpenAI or Anthropic API key"
        }
      />
      {key.trim() && (
        <p style={{ fontSize: 12, color: "var(--color-graphite)", margin: "-8px 0 14px" }}>
          {effectiveVendor ? (
            <>
              Detected: <strong>{vendorLabel(effectiveVendor)}</strong>{" "}
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: "0 4px", fontSize: 12 }}
                onClick={() => setOverrideVendor(effectiveVendor === "openai" ? "anthropic" : "openai")}
              >
                (not right? switch)
              </button>
            </>
          ) : (
            "Unrecognized key format — could not detect vendor."
          )}
        </p>
      )}
      {saved && <p className="settings-saved">Saved to Keychain as {savedVendor && vendorLabel(savedVendor)}.</p>}
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>
          Close
        </button>
        <button className="btn-solid" disabled={!key.trim() || !effectiveVendor || busy} onClick={() => void handleSave()}>
          Save
        </button>
      </div>
    </div>
  );
}

// --- Switcher + host ---------------------------------------------------------

const VARIANTS = {
  A: { component: VariantA, name: "Segmented toggle" },
  B: { component: VariantB, name: "Manage both, pick default" },
  C: { component: VariantC, name: "Auto-detect from key" },
} as const;

type VariantKey = keyof typeof VARIANTS;

function readVariant(): VariantKey {
  const raw = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
  return raw === "B" || raw === "C" ? raw : "A";
}

function setVariantParam(v: VariantKey) {
  const url = new URL(window.location.href);
  url.searchParams.set("variant", v);
  window.history.replaceState(null, "", url);
}

function PrototypeSwitcher({ current, onChange }: { current: VariantKey; onChange: (v: VariantKey) => void }) {
  const keys = Object.keys(VARIANTS) as VariantKey[];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const i = keys.indexOf(current);
      if (e.key === "ArrowLeft") onChange(keys[(i - 1 + keys.length) % keys.length]);
      if (e.key === "ArrowRight") onChange(keys[(i + 1) % keys.length]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, keys, onChange]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#111",
        color: "#fff",
        padding: "8px 14px",
        borderRadius: 999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        fontFamily: "monospace",
        fontSize: 12,
        zIndex: 999,
      }}
    >
      <button
        type="button"
        onClick={() => onChange(keys[(keys.indexOf(current) - 1 + keys.length) % keys.length])}
        style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 14 }}
      >
        ←
      </button>
      <span>
        {current} — {VARIANTS[current].name}
      </span>
      <button
        type="button"
        onClick={() => onChange(keys[(keys.indexOf(current) + 1) % keys.length])}
        style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 14 }}
      >
        →
      </button>
    </div>
  );
}

export function SettingsModalPrototype({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [variant, setVariant] = useState<VariantKey>(readVariant());

  function handleChange(v: VariantKey) {
    setVariant(v);
    setVariantParam(v);
  }

  const Variant = VARIANTS[variant].component;

  return (
    <>
      <div
        className={`modal-overlay${open ? " show" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <Variant onClose={onClose} />
      </div>
      <PrototypeSwitcher current={variant} onChange={handleChange} />
    </>
  );
}
