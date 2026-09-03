import { useEffect, useRef, useState } from "react";
import type { GenerationOptions } from "@voicecraft/core";
import type { ProfileDraft } from "../lib/useVoicecraftApp";
import { GenerationOptionsFields } from "./GenerationOptionsFields";

type Props = {
  open: boolean;
  initial?: ProfileDraft;
  onSave: (draft: ProfileDraft) => void;
  onCancel: () => void;
};

export function ProfileModal({ open, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [options, setOptions] = useState<GenerationOptions>(initial?.defaultGenerationOptions ?? {});
  const [tab, setTab] = useState<"basics" | "defaults">("basics");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setOptions(initial?.defaultGenerationOptions ?? {});
      setTab("basics");
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

        <div className="view-toggle profile-modal-tabs" role="group" aria-label="Profile section">
          <button
            type="button"
            className={`view-btn${tab === "basics" ? " active" : ""}`}
            onClick={() => setTab("basics")}
          >
            Basics
          </button>
          <button
            type="button"
            className={`view-btn${tab === "defaults" ? " active" : ""}`}
            onClick={() => setTab("defaults")}
          >
            Generation defaults
          </button>
        </div>

        {tab === "basics" ? (
          <>
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
          </>
        ) : (
          <GenerationOptionsFields value={options} onChange={setOptions} />
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-solid"
            disabled={!name.trim() || !description.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                description: description.trim(),
                defaultGenerationOptions: Object.keys(options).length > 0 ? options : undefined,
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
