import type { VoiceProfile } from "@voicecraft/core";
import { isPredefined } from "../lib/predefinedProfiles";

type Props = {
  profiles: VoiceProfile[];
  selectedProfileId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
};

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
        <span className="wordmark">
          <svg className="mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path
              d="M6 8 L20 32 L34 8"
              stroke="url(#mark-grad)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <defs>
              <linearGradient id="mark-grad" x1="0" y1="0" x2="0" y2="40">
                <stop offset="0" stopColor="#5897f7" />
                <stop offset="1" stopColor="#3872e6" />
              </linearGradient>
            </defs>
          </svg>
          Voicecraft
        </span>
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
