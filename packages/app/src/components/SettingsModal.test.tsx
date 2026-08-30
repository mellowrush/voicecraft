import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { SettingsModal } from "./SettingsModal";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

describe("SettingsModal", () => {
  it("fetches and shows the configured state for the active vendor only", async () => {
    invokeMock.mockImplementation(async (cmd: string, args?: unknown) => {
      const vendor = (args as { vendor?: string } | undefined)?.vendor;
      if (cmd === "get_api_key") return vendor === "openai" ? "existing-key" : null;
      throw new Error(`unexpected invoke: ${cmd}`);
    });

    render(<SettingsModal open activeVendor="openai" onVendorChange={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByPlaceholderText("•••• configured — enter a new key to replace it")).toBeInTheDocument(),
    );
    expect(invokeMock).toHaveBeenCalledWith("get_api_key", { vendor: "openai" });
  });

  it("does not switch the active vendor just from browsing to an unconfigured tab", async () => {
    const user = userEvent.setup();
    const onVendorChange = vi.fn();
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "get_api_key") return null;
      throw new Error(`unexpected invoke: ${cmd}`);
    });

    render(<SettingsModal open activeVendor="openai" onVendorChange={onVendorChange} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("OpenAI API key")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Anthropic" }));
    await waitFor(() => expect(screen.getByLabelText("Anthropic API key")).toBeInTheDocument());

    expect(onVendorChange).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalledWith("set_api_key", expect.anything());
  });

  it("switches the active vendor immediately when browsing to a tab that's already configured", async () => {
    const user = userEvent.setup();
    const onVendorChange = vi.fn();
    invokeMock.mockImplementation(async (cmd: string, args?: unknown) => {
      const vendor = (args as { vendor?: string } | undefined)?.vendor;
      if (cmd === "get_api_key") return vendor === "anthropic" ? "already-there" : null;
      throw new Error(`unexpected invoke: ${cmd}`);
    });

    render(<SettingsModal open activeVendor="openai" onVendorChange={onVendorChange} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("OpenAI API key")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Anthropic" }));

    await waitFor(() => expect(onVendorChange).toHaveBeenCalledWith("anthropic"));
  });

  it("saves the key under the viewed vendor and makes it the active one", async () => {
    const user = userEvent.setup();
    const onVendorChange = vi.fn();
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "get_api_key") return null;
      if (cmd === "set_api_key") return undefined;
      throw new Error(`unexpected invoke: ${cmd}`);
    });

    render(<SettingsModal open activeVendor="anthropic" onVendorChange={onVendorChange} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("Anthropic API key")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Anthropic API key"), "sk-ant-secret");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("set_api_key", { vendor: "anthropic", key: "sk-ant-secret" }),
    );
    expect(onVendorChange).toHaveBeenCalledWith("anthropic");
    expect(await screen.findByText("Saved to Keychain.")).toBeInTheDocument();
  });
});
