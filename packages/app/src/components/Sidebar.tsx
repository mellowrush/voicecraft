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
          ✎
        </button>
      )}
    </div>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <LogoMark />
        <button className="new-btn" title="New voice profile" aria-label="New voice profile" onClick={onNew}>
          +
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
