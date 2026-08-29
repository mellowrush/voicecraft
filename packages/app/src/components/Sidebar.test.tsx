import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VoiceProfile } from "@voicecraft/core";
import { Sidebar } from "./Sidebar";

const longName = "A Very Extremely Long Custom Voice Profile Name That Should Overflow The Sidebar";

const profiles: VoiceProfile[] = [
  { id: "custom-1", name: longName, description: "desc" } as VoiceProfile,
];

describe("Sidebar", () => {
  it("puts the full profile name in a title attribute for hover", () => {
    render(
      <Sidebar
        profiles={profiles}
        selectedProfileId={null}
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText(longName).closest('[role="button"]')).toHaveAttribute("title", longName);
  });
});
