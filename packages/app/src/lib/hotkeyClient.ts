import { invoke } from "@tauri-apps/api/core";

export const checkAccessibilityTrusted = (): Promise<boolean> => invoke<boolean>("check_accessibility_trusted");

export const openAccessibilityPrefs = (): Promise<void> => invoke("open_accessibility_prefs");

export const hudAccept = (text: string): Promise<void> => invoke("hud_accept", { text });

export const hudReject = (): Promise<void> => invoke("hud_reject");

export const updateTrayLastUsedProfile = (profileName: string): Promise<void> =>
  invoke("update_last_used_profile_tray", { profileName });
