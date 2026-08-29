import { useEffect, useMemo, useState } from "react";
import { createEngine } from "@voicecraft/core";
import { useVoicecraftApp } from "./lib/useVoicecraftApp";
import { tauriProvider } from "./lib/providerClient";
import { readProfilesFile, writeProfilesFile } from "./lib/tauriProfileFile";
import { updateTrayLastUsedProfile } from "./lib/hotkeyClient";
import { Sidebar } from "./components/Sidebar";
import { MainPanel } from "./components/MainPanel";
import { ProfileModal } from "./components/ProfileModal";
import { SettingsModal } from "./components/SettingsModal";
// PROTOTYPE (issue #42) — remove this import and the branch below once a
// variant is chosen. Never ships: gated on import.meta.env.DEV.
import { SettingsModalPrototype } from "./components/SettingsModal.prototype";
import { Toast } from "./components/Toast";
import "./App.css";

const showSettingsPrototype = import.meta.env.DEV && new URLSearchParams(window.location.search).has("variant");

function App() {
  const engine = useMemo(() => createEngine({ provider: tauriProvider }), []);
  const app = useVoicecraftApp({ engine, readFile: readProfilesFile, writeFile: writeProfilesFile });

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
      />

      <ProfileModal
        open={app.editingProfileId !== null}
        initial={editingProfile}
        onSave={(draft) => app.saveProfile(draft, editingProfile?.id)}
        onCancel={() => app.setEditingProfileId(null)}
      />

      {showSettingsPrototype ? (
        <SettingsModalPrototype open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      ) : (
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}

      <Toast message={toast} />
    </div>
  );
}

export default App;
