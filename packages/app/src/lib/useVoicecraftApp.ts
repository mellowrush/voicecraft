import { useCallback, useEffect, useMemo, useState } from "react";
import type { Engine, EngineError, Mode, VoiceProfile } from "@voicecraft/core";
import { loadProfiles, saveProfiles, type ReadFile, type WriteFile } from "./profileStore";
import { engineErrorMessage } from "./engineErrorMessage";

export type RunStatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; text: string }
  | { status: "error"; message: string };

export type ProfileDraft = { name: string; description: string };

export type UseVoicecraftAppOptions = {
  engine: Engine;
  readFile: ReadFile;
  writeFile: WriteFile;
};

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function useVoicecraftApp({ engine, readFile, writeFile }: UseVoicecraftAppOptions) {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [mode, setModeState] = useState<Mode>("rewrite");
  const [context, setContext] = useState("");
  const [inputText, setInputText] = useState("");
  const [run, setRun] = useState<RunStatus>({ status: "idle" });
  const [view, setView] = useState<"result" | "diff">("result");
  const [editingProfileId, setEditingProfileId] = useState<string | "new" | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProfiles(readFile, writeFile).then((loaded) => {
      if (cancelled) return;
      setProfiles(loaded);
      setSelectedProfileId((current) => current ?? loaded[0]?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
    // Runs once on mount — readFile/writeFile identity is expected to be stable per app session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  // Diff only makes sense against an original (Rewrite mode) — Generate has none.
  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    if (next === "generate") setView("result");
  }, []);

  const runAction = useCallback(async () => {
    if (!selectedProfile || !inputText.trim()) return;
    setRun({ status: "loading" });
    try {
      const result = (await engine.generate(
        {
          profile: selectedProfile,
          text: inputText,
          mode,
          context: context.trim() || undefined,
        },
        { stream: false },
      )) as { text: string };
      setRun({ status: "success", text: result.text });
    } catch (err) {
      setRun({ status: "error", message: engineErrorMessage(err as EngineError) });
    }
  }, [engine, selectedProfile, inputText, mode, context]);

  const saveProfile = useCallback(
    async (draft: ProfileDraft, existingId?: string) => {
      const id = existingId ?? slugify(draft.name);
      const next: VoiceProfile = { id, name: draft.name, description: draft.description };
      const updated = existingId ? profiles.map((p) => (p.id === existingId ? next : p)) : [...profiles, next];

      setProfiles(updated);
      await saveProfiles(updated, writeFile);
      setEditingProfileId(null);
      setSelectedProfileId(id);
    },
    [profiles, writeFile],
  );

  return {
    profiles,
    selectedProfile,
    selectedProfileId,
    setSelectedProfileId,
    mode,
    setMode,
    context,
    setContext,
    inputText,
    setInputText,
    run,
    runAction,
    view,
    setView,
    editingProfileId,
    setEditingProfileId,
    saveProfile,
  };
}
