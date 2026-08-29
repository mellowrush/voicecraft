import { useEffect, useRef, useState } from "react";
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
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      nameInputRef.current?.focus();
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  return (
    <div
      className={`modal-overlay${open ? " show" : ""}`}
      data-testid="profile-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
        <h2 id="profile-modal-title">{initial ? "Edit voice profile" : "New voice profile"}</h2>
        <label className="field-label" htmlFor="profile-name">
          Name
        </label>
        <input
          id="profile-name"
          ref={nameInputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Cofounder Voice"
        />
        <label className="field-label" htmlFor="profile-description">
          Description
        </label>
        <textarea
          id="profile-description"
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
