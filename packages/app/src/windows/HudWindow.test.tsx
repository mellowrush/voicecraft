import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { HudWindow } from "./HudWindow";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

const invokeMock = vi.mocked(invoke);
const listenMock = vi.mocked(listen);
const getCurrentWindowMock = vi.mocked(getCurrentWindow);

const PROFILE = {
  id: "p1",
  name: "Concise",
  description: "Short and to the point.",
};

let selectionHandler: (event: { payload: { text: string; profileId: string | null } }) => void;

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === "read_profiles_file") return JSON.stringify({ profiles: [PROFILE], lastUsedProfileId: "p1" });
    if (cmd === "call_provider") return "Rewritten text";
    if (cmd === "hud_accept") return undefined;
    if (cmd === "hud_reject") return undefined;
    throw new Error(`unexpected invoke: ${cmd}`);
  });

  listenMock.mockImplementation((_event, handler) => {
    selectionHandler = handler as typeof selectionHandler;
    return Promise.resolve(() => {});
  });

  getCurrentWindowMock.mockReturnValue({
    onFocusChanged: vi.fn().mockResolvedValue(() => {}),
  } as unknown as ReturnType<typeof getCurrentWindow>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function triggerSelection(text = "hello there") {
  await waitFor(() => expect(selectionHandler).toBeDefined());
  selectionHandler({ payload: { text, profileId: "p1" } });
  await waitFor(() => expect(screen.getByText("Rewritten text")).toBeInTheDocument());
}

describe("HudWindow", () => {
  it("calls hud_accept exactly once when Accept is clicked", async () => {
    const user = userEvent.setup();
    render(<HudWindow />);
    await triggerSelection();

    await user.click(screen.getByRole("button", { name: /Accept/ }));

    expect(invokeMock.mock.calls.filter(([cmd]) => cmd === "hud_accept")).toHaveLength(1);
    expect(invokeMock).toHaveBeenCalledWith("hud_accept", { text: "Rewritten text" });
  });

  it("calls hud_reject exactly once when Reject is clicked", async () => {
    const user = userEvent.setup();
    render(<HudWindow />);
    await triggerSelection();

    await user.click(screen.getByRole("button", { name: /Reject/ }));

    expect(invokeMock.mock.calls.filter(([cmd]) => cmd === "hud_reject")).toHaveLength(1);
  });
});
