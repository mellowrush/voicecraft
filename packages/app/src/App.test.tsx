import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import { predefinedProfiles } from "./lib/predefinedProfiles";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === "read_profiles_file") return "";
    if (cmd === "write_profiles_file") return undefined;
    if (cmd === "update_last_used_profile_tray") return undefined;
    if (cmd === "get_api_key") return null;
    if (cmd === "call_provider") return "Hey — following up. Thanks!";
    throw new Error(`unexpected invoke: ${cmd}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("loads and shows predefined profiles, with the first one active", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText(predefinedProfiles[1].name)).toBeInTheDocument());
    expect(screen.getAllByText(predefinedProfiles[0].name).length).toBeGreaterThan(0);
  });

  it("hides the Diff toggle in Generate mode", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Paste or type text to rewrite...")).toBeInTheDocument(),
    );

    expect(screen.getByRole("button", { name: "Diff" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Generate" }));

    expect(screen.queryByRole("button", { name: "Diff" })).not.toBeInTheDocument();
  });

  it("runs a rewrite and shows the result", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Paste or type text to rewrite...")).toBeInTheDocument(),
    );

    await user.type(screen.getByPlaceholderText("Paste or type text to rewrite..."), "hey there");
    await user.click(screen.getByTestId("run-btn"));

    await waitFor(() =>
      expect(screen.getByText("Hey — following up. Thanks!")).toBeInTheDocument(),
    );
    expect(invokeMock).toHaveBeenCalledWith("call_provider", expect.objectContaining({ prompt: expect.any(String) }));
  });

  it("copies the result to the clipboard and shows a toast", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Paste or type text to rewrite...")).toBeInTheDocument(),
    );

    await user.type(screen.getByPlaceholderText("Paste or type text to rewrite..."), "hey there");
    await user.click(screen.getByTestId("run-btn"));
    await waitFor(() => expect(screen.getByText("Hey — following up. Thanks!")).toBeInTheDocument());

    await user.click(screen.getByTitle("Copy variant 1"));

    expect(await screen.findByText("Copied to clipboard")).toBeInTheDocument();
  });

  it("creates a new custom profile from the modal", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Paste or type text to rewrite...")).toBeInTheDocument(),
    );

    await user.click(screen.getByTitle("New voice profile"));
    await user.type(screen.getByPlaceholderText("e.g. My Cofounder Voice"), "My Cofounder Voice");
    await user.type(screen.getByPlaceholderText("Describe the voice..."), "Short and direct.");
    await user.click(within(screen.getByTestId("profile-modal")).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getAllByText("My Cofounder Voice").length).toBeGreaterThan(0));
  });
});
