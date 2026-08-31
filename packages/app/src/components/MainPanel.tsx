import type { Mode, VoiceProfile } from "@voicecraft/core";
import type { RunStatus } from "../lib/useVoicecraftApp";
import { DiffView } from "./DiffView";
import { ComposeOverrideByVariant, ProfileOptionsSwitcher, useProfileOptionsVariant } from "./profileOptions.prototype";
import "./profileOptions.prototype.css";

type Props = {
  profile: VoiceProfile | null;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  context: string;
  onContextChange: (value: string) => void;
  inputText: string;
  onInputTextChange: (value: string) => void;
  run: RunStatus;
  onRun: () => void;
  view: "result" | "diff";
  onViewChange: (view: "result" | "diff") => void;
  onCopy: (text: string) => void;
  onOpenSettings: () => void;
};

export function MainPanel({
  profile,
  mode,
  onModeChange,
  context,
  onContextChange,
  inputText,
  onInputTextChange,
  run,
  onRun,
  view,
  onViewChange,
  onCopy,
  onOpenSettings,
}: Props) {
  const isRewrite = mode === "rewrite";
  const isLoading = run.status === "loading";
  const resultText = run.status === "success" ? run.text : "";

  // PROTOTYPE (#65) — renders a mocked per-generation override affordance
  // above the run bar; doesn't affect real generation.
  const profileOptionsVariant = useProfileOptionsVariant();

  return (
    <main className="main">
      <div className="main-header">
        <div className="active-summary">
          <p className="active-name">{profile?.name ?? "No voice profile"}</p>
          <p className="active-desc">{profile?.description ?? "Create or select a voice profile to begin."}</p>
        </div>

        <div className="header-actions">
          <div className="mode-toggle" role="group" aria-label="Mode">
            <button
              className={`mode-btn${isRewrite ? " active" : ""}`}
              aria-pressed={isRewrite}
              onClick={() => onModeChange("rewrite")}
            >
              Rewrite
            </button>
            <button
              className={`mode-btn${!isRewrite ? " active" : ""}`}
              aria-pressed={!isRewrite}
              onClick={() => onModeChange("generate")}
            >
              Generate
            </button>
          </div>
          <button className="settings-btn" title="Settings" aria-label="Settings" onClick={onOpenSettings}>
            ⚙
          </button>
        </div>
      </div>

      <div className="context-row">
        <label htmlFor="context-input" className="sr-only">
          Context (optional)
        </label>
        <input
          id="context-input"
          className="context-input"
          value={context}
          onChange={(e) => onContextChange(e.target.value)}
          placeholder='Context (optional) — e.g. "formal business email", "twitter reply, keep under 280 chars"'
        />
      </div>

      <div className="compose">
        <div className="panel">
          <label className="panel-label" htmlFor="compose-input">
            {isRewrite ? "Original text" : "Instruction"}
          </label>
          <textarea
            id="compose-input"
            value={inputText}
            onChange={(e) => onInputTextChange(e.target.value)}
            placeholder={isRewrite ? "Paste or type text to rewrite..." : "Describe what to generate..."}
          />
        </div>

        <div className="panel">
          <div className="panel-label-row">
            <p className="panel-label" style={{ margin: 0 }}>
              Result
            </p>
            <div className="toolbar-right">
              {isRewrite && (
                <div className="view-toggle" role="group" aria-label="View">
                  <button
                    className={`view-btn${view === "result" ? " active" : ""}`}
                    aria-pressed={view === "result"}
                    onClick={() => onViewChange("result")}
                  >
                    Result
                  </button>
                  <button
                    className={`view-btn${view === "diff" ? " active" : ""}`}
                    aria-pressed={view === "diff"}
                    onClick={() => onViewChange("diff")}
                  >
                    Diff
                  </button>
                </div>
              )}
              <button
                className="copy-btn"
                title="Copy to clipboard"
                aria-label="Copy to clipboard"
                disabled={run.status !== "success"}
                onClick={() => onCopy(resultText)}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <rect x="7" y="7" width="10" height="10" rx="2" />
                  <path d="M4 13V5a2 2 0 0 1 2-2h8" />
                </svg>
              </button>
            </div>
          </div>

          <div className="result-box" aria-live="polite">
            {isLoading && (
              <div className="skeleton active" aria-hidden="true">
                <div className="skeleton-line" style={{ width: "95%" }} />
                <div className="skeleton-line" style={{ width: "88%" }} />
                <div className="skeleton-line" style={{ width: "60%" }} />
              </div>
            )}
            {!isLoading && run.status === "error" && <p className="result-error">{run.message}</p>}
            {!isLoading && run.status === "success" && isRewrite && view === "diff" && (
              <DiffView before={inputText} after={run.text} />
            )}
            {!isLoading && run.status === "success" && (!isRewrite || view === "result") && (
              <p className="result-plain">{run.text}</p>
            )}
            {!isLoading && run.status === "idle" && <p className="result-placeholder">Result will appear here.</p>}
          </div>
        </div>
      </div>

      <ComposeOverrideByVariant variant={profileOptionsVariant} />

      <div className="action-bar">
        <span className="status">
          <span>{isLoading ? "Generating…" : "Ready"}</span> <span className="hint">⌘ Enter</span>
        </span>
        <button
          className="run-btn"
          data-testid="run-btn"
          disabled={isLoading || !inputText.trim() || !profile}
          onClick={onRun}
        >
          {isLoading && <span className="spinner" aria-hidden="true" />}
          <span>{isRewrite ? "Rewrite" : "Generate"}</span>
        </button>
      </div>

      <ProfileOptionsSwitcher current={profileOptionsVariant} />
    </main>
  );
}
