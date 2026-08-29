import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { checkAccessibilityTrusted, openAccessibilityPrefs } from "../lib/hotkeyClient";
import "../App.css";

export function OnboardingWindow() {
  const [trusted, setTrusted] = useState(false);

  useEffect(() => {
    void checkAccessibilityTrusted().then(setTrusted);
  }, []);

  // Polls while the card is up so the user doesn't have to click Recheck —
  // stops once granted, since there's nothing left to detect.
  useEffect(() => {
    if (trusted) return;
    const interval = setInterval(() => {
      void checkAccessibilityTrusted().then(setTrusted);
    }, 1500);
    return () => clearInterval(interval);
  }, [trusted]);

  // Nothing else ever dismisses this window once permission is granted — it
  // shows "Granted" and just sits there forever otherwise, which reads as
  // the popup (or the Recheck button) not working. Give the confirmation a
  // beat to register, then close it, whether "Granted" came from the poll
  // above or a manual Recheck click.
  useEffect(() => {
    if (!trusted) return;
    const timer = setTimeout(() => {
      void getCurrentWindow().hide();
    }, 900);
    return () => clearTimeout(timer);
  }, [trusted]);

  async function recheck() {
    setTrusted(await checkAccessibilityTrusted());
  }

  return (
    <div className="onboarding">
      <div className="onboard-card">
        <div className="onboard-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3161df"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <p className="onboard-title">Voicecraft needs Accessibility access</p>
        <p className="onboard-body">
          This lets ⌥ Space capture the text you&rsquo;ve selected in any app and replace it in place. Your text
          is never sent anywhere except your configured AI provider.
        </p>
        <ol className="onboard-steps">
          <li>
            <span className="step-num" aria-hidden="true">
              1
            </span>{" "}
            Click &ldquo;Open Settings&rdquo; below
          </li>
          <li>
            <span className="step-num" aria-hidden="true">
              2
            </span>{" "}
            Turn on Voicecraft under Accessibility
          </li>
          <li>
            <span className="step-num" aria-hidden="true">
              3
            </span>{" "}
            Come back and click &ldquo;Recheck&rdquo;
          </li>
        </ol>
        <div
          className={`status-pill${trusted ? " granted" : ""}`}
          data-testid="accessibility-status"
          role="status"
          aria-live="polite"
        >
          <span className="dot" aria-hidden="true" />
          <span>{trusted ? "Granted" : "Not granted"}</span>
        </div>
        <div className="onboard-actions">
          <button className="btn-solid" onClick={() => void openAccessibilityPrefs()}>
            Open Settings
          </button>
          <button className="btn-ghost" onClick={() => void recheck()}>
            Recheck
          </button>
        </div>
      </div>
    </div>
  );
}
