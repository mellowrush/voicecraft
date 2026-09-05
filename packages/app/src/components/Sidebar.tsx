import type { VoiceProfile } from "@voicecraft/core";
import { isPredefined } from "../lib/predefinedProfiles";

type Props = {
  profiles: VoiceProfile[];
  selectedProfileId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
};

// The Field Notebook mark (#44, variant C): a circular instrument-dial badge
// carries the expressive weight; the wordmark stays plain, no gradient/serif.
function LogoMark() {
  return (
    <span className="wordmark">
      <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="var(--color-stamp-red)" />
        <path d="M9 17 L13 11 L17 20 L21 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      Voicecraft
    </span>
  );
}

// Icon language matches CopyButton: stroke-only, round caps/joins, currentColor.
function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M10 5v10M5 10h10" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.4 3.4a1.6 1.6 0 0 1 2.3 2.3L7 14.5l-3.2.8.8-3.2z" />
    </svg>
  );
}

export function Sidebar({ profiles, selectedProfileId, onSelect, onNew, onEdit }: Props) {
  const predefined = profiles.filter(isPredefined);
  const custom = profiles.filter((p) => !isPredefined(p));

  const renderItem = (profile: VoiceProfile, editable: boolean) => (
    <div
      key={profile.id}
      className={`profile-item${profile.id === selectedProfileId ? " selected" : ""}`}
      role="button"
      tabIndex={0}
      title={profile.name}
      onClick={() => onSelect(profile.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(profile.id);
        }
      }}
    >
      <div className="profile-info">
        <div className="profile-name">{profile.name}</div>
        <div className="profile-desc">{profile.description}</div>
      </div>
      {editable && (
        <button
          type="button"
          className="edit-affordance"
          aria-label={`Edit ${profile.name}`}
          title="Edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(profile.id);
          }}
        >
          <EditIcon />
        </button>
      )}
    </div>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <LogoMark />
        <button className="new-btn" title="New voice profile" aria-label="New voice profile" onClick={onNew}>
          <PlusIcon />
        </button>
      </div>

      <div className="sidebar-list">
        <p className="section-label">Predefined</p>
        {predefined.map((p) => renderItem(p, false))}

        <p className="section-label mt">Custom</p>
        {custom.length === 0 && <p className="empty-hint">No custom profiles yet</p>}
        {custom.map((p) => renderItem(p, true))}
      </div>
    </aside>
  );
}
