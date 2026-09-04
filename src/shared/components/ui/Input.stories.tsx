import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "UI Kit/Input",
  component: Input,
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    defaultValue: { control: "text" },
  },
  args: {
    placeholder: "Type something…",
    disabled: false,
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { defaultValue: "hello world" },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "can't edit me" },
};

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "bad value" },
};
