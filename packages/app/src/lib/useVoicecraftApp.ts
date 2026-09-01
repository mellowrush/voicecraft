import { useCallback, useEffect, useMemo, useState } from "react";
import type { Engine, EngineError, GenerationOptions, Mode, VoiceProfile } from "@voicecraft/core";
import { loadProfiles, serializeProfilesFile, type ReadFile, type WriteFile } from "./profileStore";
import { parseHistoryFile, serializeHistoryEntry, type HistoryEntry } from "./historyStore";
import { engineErrorMessage } from "./engineErrorMessage";
import { DEFAULT_VENDOR, type Vendor } from "./vendor";

export type RunStatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; variants: string[]; requestedCount: number }
  | { status: "error"; message: string };

export type ProfileDraft = { name: string; description: string; defaultGenerationOptions?: GenerationOptions };

export type UseVoicecraftAppOptions = {
  engine: Engine;
  readFile: ReadFile;
  writeFile: WriteFile;
  readHistoryFile?: () => Promise<string>;
  appendHistoryEntry?: (entryJson: string) => Promise<void>;
  deleteHistoryEntry?: (id: string) => Promise<void>;
  clearHistory?: () => Promise<void>;
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

function optionsEqual(a: GenerationOptions | undefined, b: GenerationOptions | undefined): boolean {
  return (
    (a?.targetLength ?? null) === (b?.targetLength ?? null) &&
    (a?.variantCount ?? null) === (b?.variantCount ?? null) &&
    (a?.language ?? null) === (b?.language ?? null) &&
    (a?.diacritics ?? null) === (b?.diacritics ?? null)
  );
}

export function useVoicecraftApp({
  engine,
  readFile,
  writeFile,
  readHistoryFile = async () => "",
  appendHistoryEntry = async () => {},
  deleteHistoryEntry: deleteHistoryEntryFile = async () => {},
  clearHistory: clearHistoryFile = async () => {},
}: UseVoicecraftAppOptions) {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileIdState] = useState<string | null>(null);
  const [activeVendor, setActiveVendor] = useState<Vendor>(DEFAULT_VENDOR);
  const [mode, setModeState] = useState<Mode>("rewrite");
  const [context, setContext] = useState("");
  const [inputText, setInputText] = useState("");
  const [run, setRun] = useState<RunStatus>({ status: "idle" });
  const [view, setView] = useState<"result" | "diff">("result");
  const [editingProfileId, setEditingProfileId] = useState<string | "new" | null>(null);
  const [loaded, setLoaded] = useState(false);
  // A per-generation override of the selected profile's defaultGenerationOptions
  // (map #58's decision: overrides are just the same options object passed at
  // call time). Cleared whenever the selected profile changes, since an
  // override for one profile's settings has no meaning against another's.
  const [optionsOverride, setOptionsOverride] = useState<GenerationOptions | undefined>(undefined);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Pre-fetched at startup alongside profiles (#67's decision) so switching
  // to the History tab is always instant — no loading state needed there.
  useEffect(() => {
    let cancelled = false;
    readHistoryFile().then((raw) => {
      if (!cancelled) setHistory(parseHistoryFile(raw));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSelectedProfileId = useCallback((id: string) => {
    setSelectedProfileIdState(id);
    setOptionsOverride(undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadProfiles(readFile, writeFile).then((store) => {
      if (cancelled) return;
      setProfiles(store.profiles);
      setSelectedProfileIdState(store.lastUsedProfileId ?? store.profiles[0]?.id ?? null);
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
    const options = optionsOverride ?? selectedProfile.defaultGenerationOptions;
    try {
      const result = (await engine.generate(
        {
          profile: selectedProfile,
          text: inputText,
          mode,
          context: context.trim() || undefined,
          options,
        },
        { stream: false },
      )) as { variants: string[] };
      setRun({
        status: "success",
        variants: result.variants,
        requestedCount: options?.variantCount ?? 1,
      });

      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        profileId: selectedProfile.id,
        profileName: selectedProfile.name,
        vendor: activeVendor,
        mode,
        inputText,
        context: context.trim() || undefined,
        options,
        variants: result.variants,
      };
      setHistory((prev) => [entry, ...prev]);
      void appendHistoryEntry(serializeHistoryEntry(entry));
    } catch (err) {
      setRun({ status: "error", message: engineErrorMessage(err as EngineError) });
    }
  }, [engine, selectedProfile, inputText, mode, context, optionsOverride, activeVendor, appendHistoryEntry]);

  const deleteHistoryEntryAction = useCallback(
    (id: string) => {
      setHistory((prev) => prev.filter((e) => e.id !== id));
      void deleteHistoryEntryFile(id);
    },
    [deleteHistoryEntryFile],
  );

  const clearHistoryAction = useCallback(() => {
    setHistory([]);
    void clearHistoryFile();
  }, [clearHistoryFile]);

  // "Rerun" (#66) — loads a past generation's profile, input, context, mode,
  // and resolved options back into compose, ready to re-run or tweak further.
  // Only actually sets an override when the entry's options diverge from the
  // target profile's own defaults — otherwise the drawer would misreport
  // "customized" for a run that simply used the profile as-is.
  const rerunHistoryEntry = useCallback(
    (entry: HistoryEntry) => {
      setSelectedProfileId(entry.profileId);
      setInputText(entry.inputText);
      setContext(entry.context ?? "");
      setModeState(entry.mode);
      const targetProfile = profiles.find((p) => p.id === entry.profileId);
      setOptionsOverride(
        optionsEqual(entry.options, targetProfile?.defaultGenerationOptions) ? undefined : entry.options,
      );
    },
    [setSelectedProfileId, profiles],
  );

  const saveProfile = useCallback(
    async (draft: ProfileDraft, existingId?: string) => {
      const id = existingId ?? uniqueId(slugify(draft.name), new Set(profiles.map((p) => p.id)));
      const next: VoiceProfile = {
        id,
        name: draft.name,
        description: draft.description,
        defaultGenerationOptions: draft.defaultGenerationOptions,
      };
      const updated = existingId ? profiles.map((p) => (p.id === existingId ? next : p)) : [...profiles, next];

      setProfiles(updated);
      setEditingProfileId(null);
      setSelectedProfileId(id);
    },
    [profiles, setSelectedProfileId],
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
    optionsOverride,
    setOptionsOverride,
    history,
    deleteHistoryEntry: deleteHistoryEntryAction,
    clearHistory: clearHistoryAction,
    rerunHistoryEntry,
  };
}
