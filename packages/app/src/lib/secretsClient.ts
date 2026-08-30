import { invoke } from "@tauri-apps/api/core";
import type { Vendor } from "./vendor";

export function getApiKey(vendor: Vendor): Promise<string | null> {
  return invoke<string | null>("get_api_key", { vendor });
}

export function setApiKey(vendor: Vendor, key: string): Promise<void> {
  return invoke("set_api_key", { vendor, key });
}
