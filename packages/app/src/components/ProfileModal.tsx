import { useEffect, useState } from "react";
import type { ProfileDraft } from "../lib/useVoicecraftApp";

type Props = {
  open: boolean;
  initial?: ProfileDraft;
  onSave: (draft: ProfileDraft) => void;
  onCancel: () => void;
};

export function ProfileModal({ open, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
    }
  }, [open, initial]);

  return (
    <div className={`modal-overlay${open ? " show" : ""}`} data-testid="profile-modal">
      <div className="modal">
        <h2>{initial ? "Edit voice profile" : "New voice profile"}</h2>
        <label className="field-label">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Cofounder Voice" />
        <label className="field-label">Description</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the voice..."
          style={{ resize: "vertical" }}
        />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-solid"
            disabled={!name.trim() || !description.trim()}
            onClick={() => onSave({ name: name.trim(), description: description.trim() })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
