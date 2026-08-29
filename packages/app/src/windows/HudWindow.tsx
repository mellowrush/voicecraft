import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createEngine, type EngineError, type VoiceProfile } from "@voicecraft/core";
import { tauriProvider } from "../lib/providerClient";
import { readProfilesFile } from "../lib/tauriProfileFile";
import { parseProfilesFile } from "../lib/profileStore";
import { pickHudProfile } from "../lib/hudProfile";
import { hudAccept, hudReject } from "../lib/hotkeyClient";
import { engineErrorMessage } from "../lib/engineErrorMessage";
import "../App.css";

type HotkeySelectionPayload = { text: string; profileId: string | null };

type HudState =
  | { status: "loading"; profile: VoiceProfile | null }
  | { status: "ready"; profile: VoiceProfile; result: string }
  | { status: "error"; message: string };

export function HudWindow() {
  const [state, setState] = useState<HudState | null>(null);
  const engine = useMemo(() => createEngine({ provider: tauriProvider }), []);

  useEffect(() => {
    const unlisten = listen<HotkeySelectionPayload>("hotkey://selection", async (event) => {
      const { text, profileId } = event.payload;

      let profiles: VoiceProfile[] = [];
      try {
        profiles = parseProfilesFile(await readProfilesFile()).profiles;
      } catch {
        // fall through with an empty list — surfaced as "no profile available" below
      }
      const profile = pickHudProfile(profiles, profileId);

      setState({ status: "loading", profile });
      if (!profile) {
        setState({ status: "error", message: "No voice profile available — open Voicecraft to create one." });
        return;
      }

      try {
        const result = (await engine.generate({ profile, text, mode: "rewrite" }, { stream: false })) as {
          text: string;
        };
        setState({ status: "ready", profile, result: result.text });
      } catch (err) {
        setState({ status: "error", message: engineErrorMessage(err as EngineError) });
      }
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [engine]);

  const accept = useCallback(() => {
    if (state?.status === "ready") void hudAccept(state.result);
  }, [state]);

  const reject = useCallback(() => {
    void hudReject();
  }, []);

  // Losing focus dismisses the HUD with no changes, same as pressing Escape.
  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (!focused && state) reject();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [state, reject]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        accept();
      } else if (e.key === "Escape") {
        e.preventDefault();
        reject();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [accept, reject]);

  if (!state) return null;

  return (
    <div className="hud show">
      <div className="hud-header">
        <span className="hud-profile">
          {state.status === "ready" || state.status === "loading"
            ? `${state.profile?.name ?? "Voicecraft"} · Rewrite`
            : "Voicecraft"}
        </span>
      </div>
      <div className="hud-body" role="status" aria-live="polite">
        {state.status === "loading" && (
          <div className="hud-skeleton" data-testid="hud-skeleton" aria-hidden="true">
            <div className="hud-skel-line" style={{ width: "95%" }} />
            <div className="hud-skel-line" style={{ width: "80%" }} />
            <div className="hud-skel-line" style={{ width: "60%" }} />
          </div>
        )}
        {state.status === "ready" && <p className="hud-result">{state.result}</p>}
        {state.status === "error" && <p className="hud-error">{state.message}</p>}
      </div>
      {state.status === "ready" && (
        <div className="hud-actions">
          <button className="hud-btn hud-accept" aria-keyshortcuts="Enter" onClick={accept}>
            Accept <span className="hud-kbd" aria-hidden="true">↵</span>
          </button>
          <button className="hud-btn hud-reject" aria-keyshortcuts="Escape" onClick={reject}>
            Reject <span className="hud-kbd" aria-hidden="true">Esc</span>
          </button>
        </div>
      )}
    </div>
  );
}
