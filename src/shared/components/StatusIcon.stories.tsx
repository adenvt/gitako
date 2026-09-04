import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusIcon } from "./StatusIcon";

const meta: Meta<typeof StatusIcon> = {
  title: "Components/StatusIcon",
  component: StatusIcon,
  argTypes: {
    status: {
      control: { type: "select" },
      options: ["A", "D", "R", "C", "M", "?"],
      description: "Git status letter. A=added, D=deleted, R=renamed, C=copied, M=modified, ?=unknown.",
    },
  },
  args: { status: "A" },
  decorators: [
    (Story) => (
      <div
        style={{
          padding: 16,
          background: "var(--bg-raised)",
          display: "flex",
          gap: 16,
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof StatusIcon>;

export const Added: Story = { args: { status: "A" } };
export const Deleted: Story = { args: { status: "D" } };
export const Renamed: Story = { args: { status: "R" } };
export const Copied: Story = { args: { status: "C" } };
export const Modified: Story = { args: { status: "M" } };
export const Unknown: Story = { args: { status: "?" } };
