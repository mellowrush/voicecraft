import { useState } from "react";
import type { VoiceProfile } from "@voicecraft/core";
import { isPredefined } from "../lib/predefinedProfiles";
import { LogoMarkByVariant, LogoVariantSwitcher, useLogoVariant } from "./logoMarkVariants.prototype";
import "./logoMarkVariants.prototype.css";
import { HistorySidebarSectionA, useHistoryUIVariant } from "./historyBrowsing.prototype";
import "./historyBrowsing.prototype.css";

type Props = {
  profiles: VoiceProfile[];
  selectedProfileId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  /** PROTOTYPE (#44) — live rewrite-in-flight signal, only consumed by logo variant D. */
  isProcessing?: boolean;
};

export function Sidebar({ profiles, selectedProfileId, onSelect, onNew, onEdit, isProcessing = false }: Props) {
  const logoVariant = useLogoVariant();
  // PROTOTYPE (#66) — mocked history section, variant A only.
  const historyVariant = useHistoryUIVariant();
  // PROTOTYPE (#44) — lets you preview variant D's live-status ring without a real
  // rewrite in flight; has no effect on any other variant.
  const [simulateProcessing, setSimulateProcessing] = useState(false);
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
        <LogoMarkByVariant variant={logoVariant} isProcessing={isProcessing || simulateProcessing} />
        <button className="new-btn" title="New voice profile" aria-label="New voice profile" onClick={onNew}>
          +
        </button>
      </div>
      <LogoVariantSwitcher current={logoVariant} />
      {logoVariant === "D" && !import.meta.env.PROD && (
        <button
          type="button"
          className="proto-mark-d__sim-toggle"
          onClick={() => setSimulateProcessing((v) => !v)}
        >
          {simulateProcessing ? "Stop" : "Simulate"} processing
        </button>
      )}

      <div className="sidebar-list">
        <p className="section-label">Predefined</p>
        {predefined.map((p) => renderItem(p, false))}

        <p className="section-label mt">Custom</p>
        {custom.length === 0 && <p className="empty-hint">No custom profiles yet</p>}
        {custom.map((p) => renderItem(p, true))}
      </div>

      {historyVariant === "A" && <HistorySidebarSectionA />}
    </aside>
  );
}
