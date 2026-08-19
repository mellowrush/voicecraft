import { invoke } from "@tauri-apps/api/core";

export function getApiKey(): Promise<string | null> {
  return invoke<string | null>("get_api_key");
}

export function setApiKey(key: string): Promise<void> {
  return invoke("set_api_key", { key });
}
