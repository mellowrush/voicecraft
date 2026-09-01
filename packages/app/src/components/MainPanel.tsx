import { useState } from "react";
import type { GenerationOptions, Mode, VoiceProfile } from "@voicecraft/core";
import type { RunStatus } from "../lib/useVoicecraftApp";
import type { HistoryEntry } from "../lib/historyStore";
import { DiffView } from "./DiffView";
import { GenerationOptionsFields } from "./GenerationOptionsFields";
import { HistoryView } from "./HistoryView";

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
  optionsOverride: GenerationOptions | undefined;
  onOptionsOverrideChange: (options: GenerationOptions | undefined) => void;
  history: HistoryEntry[];
  onRerunHistoryEntry: (entry: HistoryEntry) => void;
  onDeleteHistoryEntry: (id: string) => void;
  onClearHistory: () => void;
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
  optionsOverride,
  onOptionsOverrideChange,
  history,
  onRerunHistoryEntry,
  onDeleteHistoryEntry,
  onClearHistory,
}: Props) {
  const isRewrite = mode === "rewrite";
  const isLoading = run.status === "loading";
  const variants = run.status === "success" ? run.variants : [];
  // Diff only compares one before/after pair, so it's only offered when the
  // call actually produced exactly one variant.
  const canShowDiff = isRewrite && variants.length === 1;
  const effectiveOptions = optionsOverride ?? profile?.defaultGenerationOptions ?? {};
  const skeletonCount = effectiveOptions.variantCount ?? 1;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isCustomized = optionsOverride !== undefined;
  const [activeTab, setActiveTab] = useState<"compose" | "history">("compose");

  return (
    <main className="main">
      <div className="main-header">
        <div className="active-summary">
          <p className="active-name">{profile?.name ?? "No voice profile"}</p>
          <p className="active-desc">{profile?.description ?? "Create or select a voice profile to begin."}</p>
        </div>

        <div className="header-actions">
          {activeTab === "compose" && (
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
          )}
          <div className="mode-toggle" role="group" aria-label="View">
            <button
              className={`mode-btn${activeTab === "compose" ? " active" : ""}`}
              aria-pressed={activeTab === "compose"}
              onClick={() => setActiveTab("compose")}
            >
              Compose
            </button>
            <button
              className={`mode-btn${activeTab === "history" ? " active" : ""}`}
              aria-pressed={activeTab === "history"}
              onClick={() => setActiveTab("history")}
            >
              History
            </button>
          </div>
          <button className="settings-btn" title="Settings" aria-label="Settings" onClick={onOpenSettings}>
            ⚙
          </button>
        </div>
      </div>

      {activeTab === "history" ? (
        <HistoryView
          history={history}
          onRerun={(entry) => {
            onRerunHistoryEntry(entry);
            setActiveTab("compose");
          }}
          onDelete={onDeleteHistoryEntry}
          onClearAll={onClearHistory}
          onCopy={onCopy}
        />
      ) : (
        <>
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
            </div>
          </div>

          <div className="result-box" aria-live="polite">
            {isLoading && (
              <div className="variant-stack" aria-hidden="true">
                {Array.from({ length: skeletonCount }, (_, i) => (
                  <div className="variant-card" key={i}>
                    <div className="skeleton active">
                      <div className="skeleton-line" style={{ width: "95%" }} />
                      <div className="skeleton-line" style={{ width: "88%" }} />
                      <div className="skeleton-line" style={{ width: "60%" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isLoading && run.status === "error" && <p className="result-error">{run.message}</p>}
            {!isLoading && run.status === "success" && canShowDiff && view === "diff" && (
              <DiffView before={inputText} after={variants[0]} />
            )}
            {!isLoading && run.status === "success" && (!canShowDiff || view === "result") && (
              <div className="variant-stack">
                {variants.map((text, i) => (
                  <div className="variant-card" key={i}>
                    <div className="variant-card-head">
                      <span>Variant {i + 1}</span>
                      <button
                        className="copy-btn"
                        title={`Copy variant ${i + 1}`}
                        aria-label={`Copy variant ${i + 1}`}
                        onClick={() => onCopy(text)}
                      >
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                          <rect x="7" y="7" width="10" height="10" rx="2" />
                          <path d="M4 13V5a2 2 0 0 1 2-2h8" />
                        </svg>
                      </button>
                    </div>
                    <p className="result-plain">{text}</p>
                  </div>
                ))}
                {variants.length < run.requestedCount && (
                  <p className="variant-partial-notice">
                    Generated {variants.length} of {run.requestedCount} requested variants.
                  </p>
                )}
              </div>
            )}
            {!isLoading && run.status === "idle" && <p className="result-placeholder">Result will appear here.</p>}
          </div>
        </div>
      </div>

      <div className="override-drawer-wrap">
        <button type="button" className="override-drawer-toggle" onClick={() => setDrawerOpen((v) => !v)}>
          {drawerOpen ? "▾" : "▸"} Adjust for this generation{isCustomized ? " · customized" : ""}
        </button>
        {drawerOpen && (
          <div className="override-drawer">
            <GenerationOptionsFields value={effectiveOptions} onChange={onOptionsOverrideChange} />
            <button type="button" className="btn-ghost" onClick={() => onOptionsOverrideChange(undefined)}>
              Reset to profile defaults
            </button>
          </div>
        )}
      </div>

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
        </>
      )}
    </main>
  );
}
