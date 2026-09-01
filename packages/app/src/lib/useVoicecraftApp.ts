import { useCallback, useEffect, useMemo, useState } from "react";
import type { Engine, EngineError, Mode, VoiceProfile } from "@voicecraft/core";
import { loadProfiles, serializeProfilesFile, type ReadFile, type WriteFile } from "./profileStore";
import { engineErrorMessage } from "./engineErrorMessage";
import { DEFAULT_VENDOR, type Vendor } from "./vendor";

export type RunStatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; variants: string[]; requestedCount: number }
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

// A new profile's id must not collide with an existing one (predefined or
// custom) — a collision would make the new profile unreachable/unselectable.
function uniqueId(base: string, existingIds: Set<string>): string {
  if (!existingIds.has(base)) return base;
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function useVoicecraftApp({ engine, readFile, writeFile }: UseVoicecraftAppOptions) {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [activeVendor, setActiveVendor] = useState<Vendor>(DEFAULT_VENDOR);
  const [mode, setModeState] = useState<Mode>("rewrite");
  const [context, setContext] = useState("");
  const [inputText, setInputText] = useState("");
  const [run, setRun] = useState<RunStatus>({ status: "idle" });
  const [view, setView] = useState<"result" | "diff">("result");
  const [editingProfileId, setEditingProfileId] = useState<string | "new" | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadProfiles(readFile, writeFile).then((store) => {
      if (cancelled) return;
      setProfiles(store.profiles);
      setSelectedProfileId(store.lastUsedProfileId ?? store.profiles[0]?.id ?? null);
      setActiveVendor(store.activeVendor);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // Runs once on mount — readFile/writeFile identity is expected to be stable per app session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single writer for the profiles store — keeps `profiles`,
  // `selectedProfileId` (the hotkey flow's last-used profile, per issue
  // #21) and `activeVendor` (#42, read by the HUD's separate webview via
  // this same file) persisted together in one file, so there's no separate
  // write path to keep in sync with this one.
  useEffect(() => {
    if (!loaded) return;
    void writeFile(serializeProfilesFile({ profiles, lastUsedProfileId: selectedProfileId, activeVendor }));
  }, [loaded, profiles, selectedProfileId, activeVendor, writeFile]);

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
          options: selectedProfile.defaultGenerationOptions,
        },
        { stream: false },
      )) as { variants: string[] };
      setRun({
        status: "success",
        variants: result.variants,
        requestedCount: selectedProfile.defaultGenerationOptions?.variantCount ?? 1,
      });
    } catch (err) {
      setRun({ status: "error", message: engineErrorMessage(err as EngineError) });
    }
  }, [engine, selectedProfile, inputText, mode, context]);

  const saveProfile = useCallback(
    async (draft: ProfileDraft, existingId?: string) => {
      const id = existingId ?? uniqueId(slugify(draft.name), new Set(profiles.map((p) => p.id)));
      const next: VoiceProfile = { id, name: draft.name, description: draft.description };
      const updated = existingId ? profiles.map((p) => (p.id === existingId ? next : p)) : [...profiles, next];

      setProfiles(updated);
      setEditingProfileId(null);
      setSelectedProfileId(id);
    },
    [profiles],
  );

  return {
    profiles,
    selectedProfile,
    selectedProfileId,
    setSelectedProfileId,
    activeVendor,
    setActiveVendor,
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
