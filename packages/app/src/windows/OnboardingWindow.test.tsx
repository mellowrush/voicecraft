import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { OnboardingWindow } from "./OnboardingWindow";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

beforeEach(() => {
  invokeMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
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
});
