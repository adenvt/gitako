import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./Textarea";

const meta: Meta<typeof Textarea> = {
  title: "UI Kit/Textarea",
  component: Textarea,
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    defaultValue: { control: "text" },
    rows: { control: { type: "number", min: 1, max: 20 } },
  },
  args: {
    placeholder: "Write a commit message…",
    rows: 4,
  },
};

export default meta;

type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const WithContent: Story = {
  args: { defaultValue: "feat(commit-graph): color-row left bars" },
};

export const Resized: Story = {
  args: { defaultValue: "This textarea is taller.", rows: 8 },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "can't edit me" },
};
