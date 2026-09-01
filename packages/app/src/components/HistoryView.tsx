import { useMemo, useState } from "react";
import type { HistoryEntry } from "../lib/historyStore";
import { CopyButton } from "./CopyButton";

type Props = {
  history: HistoryEntry[];
  onRerun: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onCopy: (text: string) => void;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Real implementation of the winning history-browsing design (Variant C,
// issue #66) — a full-view tab swap, filterable expandable card list, with
// a direct Rerun action per entry. No modal.
export function HistoryView({ history, onRerun, onDelete, onClearAll, onCopy }: Props) {
  const [profileFilter, setProfileFilter] = useState<string | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const profileNames = useMemo(() => Array.from(new Set(history.map((e) => e.profileName))), [history]);
  const filtered = profileFilter === "all" ? history : history.filter((e) => e.profileName === profileFilter);

  return (
    <div className="history-view">
      <div className="history-view-head">
        <select
          className="history-filter"
          aria-label="Filter by profile"
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
        >
          <option value="all">All profiles</option>
          {profileNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {history.length > 0 && (
          <button type="button" className="history-clear-all" onClick={onClearAll}>
            Clear all
          </button>
        )}
      </div>

      {filtered.length === 0 && <p className="result-placeholder">No history yet.</p>}

      {filtered.map((entry) => {
        const expanded = expandedId === entry.id;
        return (
          <div className="history-card" key={entry.id}>
            <div className="history-card-head" onClick={() => setExpandedId(expanded ? null : entry.id)}>
              <span className="history-card-profile">{entry.profileName}</span>
              <span className="history-card-time">{formatTime(entry.createdAt)}</span>
              <div className="history-card-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRerun(entry);
                  }}
                >
                  Rerun
                </button>
                <button
                  type="button"
                  className="history-card-delete"
                  aria-label={`Delete history entry from ${entry.profileName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            {expanded && (
              <div className="history-card-body">
                <p className="result-plain">{entry.inputText}</p>
                {entry.variants.map((text, i) => (
                  <div className="variant-card" key={i}>
                    <div className="variant-card-head">
                      <span>Variant {i + 1}</span>
                      <CopyButton text={text} label={`Copy variant ${i + 1}`} onCopy={onCopy} />
                    </div>
                    <p className="result-plain">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
