import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { OnboardingWindow } from "./OnboardingWindow";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

const invokeMock = vi.mocked(invoke);
const getCurrentWindowMock = vi.mocked(getCurrentWindow);
const hideMock = vi.fn();
let focusHandler: (event: { payload: boolean }) => void;

beforeEach(() => {
  invokeMock.mockReset();
  hideMock.mockReset();
  getCurrentWindowMock.mockReturnValue({
    hide: hideMock,
    onFocusChanged: vi.fn().mockImplementation((handler: typeof focusHandler) => {
      focusHandler = handler;
      return Promise.resolve(() => {});
    }),
  } as unknown as ReturnType<typeof getCurrentWindow>);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("OnboardingWindow", () => {
  it("shows 'Not granted' when accessibility is not trusted", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "check_accessibility_trusted") return false;
      throw new Error(`unexpected invoke: ${cmd}`);
    });

    render(<OnboardingWindow />);

    await waitFor(() => expect(screen.getByTestId("accessibility-status")).toHaveTextContent("Not granted"));
  });

  it("shows 'Granted' when accessibility is trusted", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "check_accessibility_trusted") return true;
      throw new Error(`unexpected invoke: ${cmd}`);
    });

    render(<OnboardingWindow />);

    await waitFor(() => expect(screen.getByTestId("accessibility-status")).toHaveTextContent("Granted"));
  });

  it("hides the window shortly after accessibility becomes trusted, not immediately", async () => {
    vi.useFakeTimers();
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "check_accessibility_trusted") return true;
      throw new Error(`unexpected invoke: ${cmd}`);
    });

    render(<OnboardingWindow />);

    await vi.waitFor(() => expect(screen.getByTestId("accessibility-status")).toHaveTextContent("Granted"));
    expect(hideMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(900);

    expect(hideMock).toHaveBeenCalledTimes(1);
  });

  it("never hides the window while accessibility is not trusted", async () => {
    vi.useFakeTimers();
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "check_accessibility_trusted") return false;
      throw new Error(`unexpected invoke: ${cmd}`);
    });

    render(<OnboardingWindow />);

    await vi.waitFor(() => expect(screen.getByTestId("accessibility-status")).toHaveTextContent("Not granted"));
    await vi.advanceTimersByTimeAsync(5000);

    expect(hideMock).not.toHaveBeenCalled();
  });

  it("re-checks trust on refocus instead of trusting stale state from before", async () => {
    let trusted = true;
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "check_accessibility_trusted") return trusted;
      throw new Error(`unexpected invoke: ${cmd}`);
    });

    render(<OnboardingWindow />);
    await waitFor(() => expect(screen.getByTestId("accessibility-status")).toHaveTextContent("Granted"));

    // Permission gets revoked while the (still-mounted, just hidden) window
    // is out of view, then the hotkey path shows it again.
    trusted = false;
    focusHandler({ payload: true });

    await waitFor(() => expect(screen.getByTestId("accessibility-status")).toHaveTextContent("Not granted"));
  });
});
