import { invoke } from "@tauri-apps/api/core";

export const readHistoryFile = (): Promise<string> => invoke<string>("read_history_file");

export const appendHistoryEntry = (entryJson: string): Promise<void> =>
  invoke("append_history_entry", { entryJson });

export const deleteHistoryEntry = (id: string): Promise<void> => invoke("delete_history_entry", { id });

export const clearHistory = (): Promise<void> => invoke("clear_history");
