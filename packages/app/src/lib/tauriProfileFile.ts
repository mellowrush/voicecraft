import { invoke } from "@tauri-apps/api/core";

export const readProfilesFile = (): Promise<string> => invoke<string>("read_profiles_file");

export const writeProfilesFile = (contents: string): Promise<void> =>
  invoke("write_profiles_file", { contents });
