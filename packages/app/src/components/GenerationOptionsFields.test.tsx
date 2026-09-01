import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GenerationOptionsFields } from "./GenerationOptionsFields";

describe("GenerationOptionsFields", () => {
  it("disables the Strip diacritics option when the language doesn't support it", () => {
    render(<GenerationOptionsFields value={{ language: "tr" }} onChange={vi.fn()} />);

    expect(screen.getByRole("option", { name: /Strip/ })).toBeDisabled();
  });

  it("enables the Strip diacritics option for a language that supports it", () => {
    render(<GenerationOptionsFields value={{ language: "ro" }} onChange={vi.fn()} />);

    expect(screen.getByRole("option", { name: "Strip" })).toBeEnabled();
  });

  it("disables Strip when no language is set at all", () => {
    render(<GenerationOptionsFields value={{}} onChange={vi.fn()} />);

    expect(screen.getByRole("option", { name: /Strip/ })).toBeDisabled();
  });

  it("clears diacritics when changing to a language that no longer supports stripping", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GenerationOptionsFields value={{ language: "ro", diacritics: "strip" }} onChange={onChange} />);

    await user.clear(screen.getByLabelText("Output language"));
    await user.type(screen.getByLabelText("Output language"), "tr");

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.diacritics).toBeUndefined();
  });
});
