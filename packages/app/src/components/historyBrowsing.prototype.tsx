// PROTOTYPE — throwaway code for issue #66 (history browsing UI). Three
// structurally different ways to browse/filter/delete generation history and
// relate an entry back to the compose view, switchable via `?variant=`. Mock
// data only — history.jsonl / Rust commands don't exist yet (ADR-0008, #64
// is decision-only). Not wired into production; strip before merging.
import { useEffect, useMemo, useState } from "react";

export const HISTORY_VARIANTS = ["current", "A", "B", "C"] as const;
export type HistoryUIVariant = (typeof HISTORY_VARIANTS)[number];

const LABELS: Record<HistoryUIVariant, string> = {
  current: "Current — no history UI",
  A: "A — Sidebar section, read-only preview + Restore",
  B: "B — History modal, master-detail, Load into compose",
  C: "C — Full-view tab swap, inline expand + direct Rerun",
};

export type MockHistoryEntry = {
  id: string;
  createdAt: string;
  profileName: string;
  mode: "rewrite" | "generate";
  inputText: string;
  variants: string[];
};

const MOCK_HISTORY: MockHistoryEntry[] = [
  {
    id: "1",
    createdAt: "2026-08-31T09:12:00Z",
    profileName: "Roger Sterling",
    mode: "rewrite",
    inputText: "We should really consider the new vendor proposal.",
    variants: ["When the vendor pitched \"synergy,\" I nearly spilled my drink. We called that a Tuesday in 1974."],
  },
  {
    id: "2",
    createdAt: "2026-08-31T08:47:00Z",
    profileName: "Formal Business",
    mode: "rewrite",
    inputText: "hey can u send me the report",
    variants: [
      "Could you please send me the report at your earliest convenience?",
      "I would appreciate it if you could forward the report when you have a moment.",
    ],
  },
  {
    id: "3",
    createdAt: "2026-08-30T17:03:00Z",
    profileName: "Roger Sterling",
    mode: "generate",
    inputText: "A one-line toast for a product launch.",
    variants: ["To the revolution — catering included, humility optional."],
  },
  {
    id: "4",
    createdAt: "2026-08-30T11:20:00Z",
    profileName: "Formal Business",
    mode: "rewrite",
    inputText: "the client is mad about the delay",
    variants: ["The client has expressed concern regarding the project delay."],
  },
];

function useMockHistoryState() {
  const [entries, setEntries] = useState(MOCK_HISTORY);
  const [profileFilter, setProfileFilter] = useState<string | "all">("all");
  const profiles = useMemo(() => Array.from(new Set(MOCK_HISTORY.map((e) => e.profileName))), []);
  const filtered = profileFilter === "all" ? entries : entries.filter((e) => e.profileName === profileFilter);
  const remove = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));
  const clearAll = () => setEntries([]);
  return { entries: filtered, profiles, profileFilter, setProfileFilter, remove, clearAll };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// A: a third sidebar section, below Custom. Clicking an entry shows it
// read-only in a small inline preview; a "Restore to compose" button is the
// only way back into an editable compose call.
export function HistorySidebarSectionA() {
  const { entries, profiles, profileFilter, setProfileFilter, remove, clearAll } = useMockHistoryState();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = entries.find((e) => e.id === openId) ?? null;

  return (
    <div className="proto-hist__sidebar-section">
      <div className="proto-hist__sidebar-head">
        <p className="section-label mt">History</p>
        <select className="proto-hist__filter" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)}>
          <option value="all">All profiles</option>
          {profiles.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      {entries.length === 0 && <p className="empty-hint">No history yet</p>}
      {entries.map((e) => (
        <div key={e.id} className="proto-hist__row" onClick={() => setOpenId(e.id)}>
          <div className="proto-hist__row-main">
            <span className="proto-hist__row-profile">{e.profileName}</span>
            <span className="proto-hist__row-time">{formatTime(e.createdAt)}</span>
          </div>
          <button
            type="button"
            className="proto-hist__row-delete"
            aria-label="Delete"
            onClick={(ev) => {
              ev.stopPropagation();
              remove(e.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      {entries.length > 0 && (
        <button type="button" className="proto-hist__clear-all" onClick={clearAll}>
          Clear all
        </button>
      )}
      {open && (
        <div className="proto-hist__preview">
          <p className="proto-hist__preview-input">{open.inputText}</p>
          <p className="proto-hist__preview-result">{open.variants[0]}</p>
          <button type="button" className="btn-solid proto-hist__restore">
            Restore to compose
          </button>
        </div>
      )}
    </div>
  );
}

// B: a header button opens a full modal — filterable list on the left,
// selected record's detail on the right, "Load into compose" re-populates
// the real compose view (profile + input + settings) and closes the modal.
export function HistoryButtonB() {
  const [modalOpen, setModalOpen] = useState(false);
  const { entries, profiles, profileFilter, setProfileFilter, remove, clearAll } = useMockHistoryState();
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const selected = entries.find((e) => e.id === selectedId) ?? entries[0] ?? null;

  return (
    <>
      <button className="settings-btn" title="History" aria-label="History" onClick={() => setModalOpen(true)}>
        🕘
      </button>
      <div className={`modal-overlay${modalOpen ? " show" : ""}`} onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
        <div className="modal proto-hist__modal" role="dialog" aria-modal="true">
          <h2>History</h2>
          <div className="proto-hist__modal-body">
            <div className="proto-hist__modal-list">
              <select className="proto-hist__filter" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)}>
                <option value="all">All profiles</option>
                {profiles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {entries.map((e) => (
                <div
                  key={e.id}
                  className={`proto-hist__row${selected?.id === e.id ? " proto-hist__row--active" : ""}`}
                  onClick={() => setSelectedId(e.id)}
                >
                  <div className="proto-hist__row-main">
                    <span className="proto-hist__row-profile">{e.profileName}</span>
                    <span className="proto-hist__row-time">{formatTime(e.createdAt)}</span>
                  </div>
                  <button
                    type="button"
                    className="proto-hist__row-delete"
                    aria-label="Delete"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      remove(e.id);
                      if (selectedId === e.id) setSelectedId(null);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {entries.length > 0 && (
                <button type="button" className="proto-hist__clear-all" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
            <div className="proto-hist__modal-detail">
              {selected ? (
                <>
                  <p className="panel-label">Input</p>
                  <p className="result-plain">{selected.inputText}</p>
                  <p className="panel-label" style={{ marginTop: 12 }}>
                    Result
                  </p>
                  {selected.variants.map((v, i) => (
                    <p className="result-plain" key={i}>
                      {v}
                    </p>
                  ))}
                  <button type="button" className="btn-solid" style={{ marginTop: 12 }}>
                    Load into compose
                  </button>
                </>
              ) : (
                <p className="result-placeholder">Select an entry.</p>
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// C: no modal at all — a "Compose | History" tab in the main header swaps
// the entire content area. Entries expand inline; each has a direct Rerun
// action that loads it into compose AND switches back to the Compose tab.
export function MainHeaderTabsC({ tab, onTabChange }: { tab: "compose" | "history"; onTabChange: (t: "compose" | "history") => void }) {
  return (
    <div className="mode-toggle" role="group" aria-label="View">
      <button className={`mode-btn${tab === "compose" ? " active" : ""}`} onClick={() => onTabChange("compose")}>
        Compose
      </button>
      <button className={`mode-btn${tab === "history" ? " active" : ""}`} onClick={() => onTabChange("history")}>
        History
      </button>
    </div>
  );
}

export function HistoryFullViewC({ onRerun }: { onRerun: () => void }) {
  const { entries, profiles, profileFilter, setProfileFilter, remove, clearAll } = useMockHistoryState();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="proto-hist__fullview">
      <div className="proto-hist__fullview-head">
        <select className="proto-hist__filter" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)}>
          <option value="all">All profiles</option>
          {profiles.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {entries.length > 0 && (
          <button type="button" className="proto-hist__clear-all" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>
      {entries.length === 0 && <p className="result-placeholder">No history yet.</p>}
      {entries.map((e) => {
        const expanded = expandedId === e.id;
        return (
          <div key={e.id} className="proto-hist__card">
            <div className="proto-hist__card-head" onClick={() => setExpandedId(expanded ? null : e.id)}>
              <span className="proto-hist__row-profile">{e.profileName}</span>
              <span className="proto-hist__row-time">{formatTime(e.createdAt)}</span>
              <div className="proto-hist__card-actions">
                <button type="button" className="btn-ghost" onClick={(ev) => { ev.stopPropagation(); onRerun(); }}>
                  Rerun
                </button>
                <button
                  type="button"
                  className="proto-hist__row-delete"
                  aria-label="Delete"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    remove(e.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            {expanded && (
              <div className="proto-hist__card-body">
                <p className="result-plain">{e.inputText}</p>
                {e.variants.map((v, i) => (
                  <p className="result-plain" key={i}>
                    {v}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function useHistoryUIVariant(): HistoryUIVariant {
  const fromUrl = new URLSearchParams(window.location.search).get("variant");
  return (HISTORY_VARIANTS as readonly string[]).includes(fromUrl ?? "") ? (fromUrl as HistoryUIVariant) : "current";
}

export function HistoryVariantSwitcher({ current }: { current: HistoryUIVariant }) {
  const index = HISTORY_VARIANTS.indexOf(current);

  const go = (delta: number) => {
    const next = HISTORY_VARIANTS[(index + delta + HISTORY_VARIANTS.length) % HISTORY_VARIANTS.length];
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
