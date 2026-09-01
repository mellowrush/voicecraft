import { useEffect, useMemo, useState } from "react";
import { createEngine } from "@voicecraft/core";
import { useVoicecraftApp } from "./lib/useVoicecraftApp";
import { tauriProvider } from "./lib/providerClient";
import { readProfilesFile, writeProfilesFile } from "./lib/tauriProfileFile";
import { appendHistoryEntry, clearHistory, deleteHistoryEntry, readHistoryFile } from "./lib/tauriHistoryFile";
import { updateTrayLastUsedProfile } from "./lib/hotkeyClient";
import { Sidebar } from "./components/Sidebar";
import { MainPanel } from "./components/MainPanel";
import { ProfileModal } from "./components/ProfileModal";
import { SettingsModal } from "./components/SettingsModal";
import { Toast } from "./components/Toast";
import "./App.css";

function App() {
  const engine = useMemo(() => createEngine({ provider: tauriProvider }), []);
  const app = useVoicecraftApp({
    engine,
    readFile: readProfilesFile,
    writeFile: writeProfilesFile,
    readHistoryFile,
    appendHistoryEntry,
    deleteHistoryEntry,
    clearHistory,
  });

  // Keeps the tray's "last used" label in sync with the window app's
  // selection, so the menu bar reflects it without polling from Rust.
  useEffect(() => {
    if (app.selectedProfile) void updateTrayLastUsedProfile(app.selectedProfile.name);
  }, [app.selectedProfile]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        app.runAction();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [app]);

  async function handleCopy(text: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setToast("Copied to clipboard");
  }

  const editingProfile =
    app.editingProfileId && app.editingProfileId !== "new"
      ? app.profiles.find((p) => p.id === app.editingProfileId)
      : undefined;

  return (
    <div className="app">
      <Sidebar
        profiles={app.profiles}
        selectedProfileId={app.selectedProfileId}
        onSelect={app.setSelectedProfileId}
        onNew={() => app.setEditingProfileId("new")}
        onEdit={(id) => app.setEditingProfileId(id)}
        isProcessing={app.run.status === "loading"}
      />

      <MainPanel
        profile={app.selectedProfile}
        mode={app.mode}
        onModeChange={app.setMode}
        context={app.context}
        onContextChange={app.setContext}
        inputText={app.inputText}
        onInputTextChange={app.setInputText}
        run={app.run}
        onRun={app.runAction}
        view={app.view}
        onViewChange={app.setView}
        onCopy={handleCopy}
        onOpenSettings={() => setSettingsOpen(true)}
        optionsOverride={app.optionsOverride}
        onOptionsOverrideChange={app.setOptionsOverride}
        history={app.history}
        onRerunHistoryEntry={app.rerunHistoryEntry}
        onDeleteHistoryEntry={app.deleteHistoryEntry}
        onClearHistory={app.clearHistory}
      />

      <ProfileModal
        open={app.editingProfileId !== null}
        initial={editingProfile}
        onSave={(draft) => app.saveProfile(draft, editingProfile?.id)}
        onCancel={() => app.setEditingProfileId(null)}
      />

      <SettingsModal
        open={settingsOpen}
        activeVendor={app.activeVendor}
        onVendorChange={app.setActiveVendor}
        onClose={() => setSettingsOpen(false)}
      />

      <Toast message={toast} />
    </div>
  );
}

export default App;
