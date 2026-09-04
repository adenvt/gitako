import { createRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DiffMinimap } from "./DiffMinimap";
import type { DiffRow } from "./align";

const ROWS: DiffRow[] = Array.from({ length: 40 }, (_, i) => ({
  oldKind: i % 11 === 0 ? "remove" : null,
  oldLine: i % 11 === 0 ? `Old ${i + 1}` : null,
  oldNum: i % 11 === 0 ? i + 1 : null,
  newKind: i % 7 === 0 ? "add" : null,
  newLine: i % 7 === 0 ? `New ${i + 1}` : null,
  newNum: i % 7 === 0 ? i + 1 : null,
}));

const meta: Meta<typeof DiffMinimap> = {
  title: "Features/DiffMinimap",
  component: DiffMinimap,
  decorators: [
    (Story) => (
      <div style={{ width: 300, height: 240, position: "relative" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DiffMinimap>;

export const New: Story = {
  args: { side: "new", rows: ROWS, viewportRef: createRef<HTMLDivElement>() },
};

export const Old: Story = {
  args: { side: "old", rows: ROWS, viewportRef: createRef<HTMLDivElement>() },
};
