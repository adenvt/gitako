import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./Textarea";

const meta: Meta<typeof Textarea> = {
  title: "UI Kit/Textarea",
  component: Textarea,
  argTypes: {
    size: { control: { type: "select" }, options: ["sm", "md", "lg"] },
    state: { control: { type: "select" }, options: [undefined, "invalid"] },
    clearable: { control: "boolean" },
    disabled: { control: "boolean" },
    rows: { control: "number" },
    placeholder: { control: "text" },
  },
  args: { size: "md", rows: 4, placeholder: "Description…" },
};
export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = {
  args: { state: "invalid", defaultValue: "invalid input" },
};
export const Clearable: Story = {
  args: { clearable: true, defaultValue: "clear me" },
};
