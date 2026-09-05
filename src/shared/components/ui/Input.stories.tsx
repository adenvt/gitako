import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";
import { SearchIcon } from "@primer/octicons-react";

const meta: Meta<typeof Input> = {
  title: "UI Kit/Input",
  component: Input,
  argTypes: {
    size: { control: { type: "select" }, options: ["sm", "md", "lg"] },
    state: {
      control: { type: "select" },
      options: [undefined, "loading", "success", "invalid"],
    },
    clearable: { control: "boolean" },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
    defaultValue: { control: "text" },
    type: {
      control: { type: "select" },
      options: ["text", "password", "email", "url", "search"],
    },
  },
  args: {
    size: "md",
    clearable: false,
    disabled: false,
    placeholder: "Type here…",
  },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "hello world" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Password: Story = {
  args: { type: "password", placeholder: "API key" },
};
export const Loading: Story = {
  args: { state: "loading", defaultValue: "Checking…" },
};
export const Success: Story = {
  args: { state: "success", defaultValue: "looks good" },
};
export const Invalid: Story = {
  args: { state: "invalid", defaultValue: "not a URL" },
};
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "locked" },
};
export const Clearable: Story = {
  args: { clearable: true, defaultValue: "clear me" },
};
export const WithPrepend: Story = {
  args: {
    prepend: <SearchIcon size={13} aria-hidden />,
    placeholder: "Search…",
  },
};
export const WithAppend: Story = {
  args: {
    append: <span style={{ opacity: 0.6 }}>@github.com</span>,
    defaultValue: "ade",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: 320,
      }}
    >
      <Input placeholder="default" />
      <Input size="sm" placeholder="sm" />
      <Input size="lg" placeholder="lg" />
      <Input state="loading" defaultValue="loading" />
      <Input state="success" defaultValue="success" />
      <Input state="invalid" defaultValue="invalid" />
      <Input disabled placeholder="disabled" />
      <Input clearable defaultValue="clear me" />
      <Input prepend={<SearchIcon size={13} aria-hidden />} placeholder="with prepend" />
    </div>
  ),
};
