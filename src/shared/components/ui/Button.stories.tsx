import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "UI Kit/Button",
  component: Button,
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["solid", "primary", "ghost", "subtle", "danger", "none"],
      description: "Visual style. 'none' keeps only caller classes.",
    },
    size: {
      control: { type: "select" },
      options: ["sm", "md", "lg", "icon"],
      description:
        "Control size. 'md' is default, 'lg' for emphasis (max one per surface), 'icon' for square hit-targets.",
    },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
    children: { control: "text" },
  },
  args: {
    variant: "solid",
    size: "md",
    loading: false,
    disabled: false,
    children: "Button",
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Solid: Story = {};

export const Primary: Story = {
  args: { variant: "primary", children: "Primary" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Ghost" },
};

export const Subtle: Story = {
  args: { variant: "subtle", children: "Subtle" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Delete branch" },
};

export const None: Story = {
  args: { variant: "none", children: "None (caller-styled)" },
  decorators: [
    (Story) => (
      <div style={{ padding: 8, background: "var(--bg-raised)" }}>
        <Story />
      </div>
    ),
  ],
};

export const Small: Story = {
  args: { size: "sm", children: "Small" },
};

export const Large: Story = {
  args: { size: "lg", children: "Get started" },
};

export const IconOnly: Story = {
  args: { size: "icon", "aria-label": "Close", children: "×" },
};

export const Loading: Story = {
  args: { loading: true, children: "Push" },
};

export const LoadingSizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Button size="sm" loading>
        sm
      </Button>
      <Button loading>md</Button>
      <Button size="lg" loading>
        lg
      </Button>
      <Button size="icon" aria-label="Loading" loading />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, children: "Disabled" },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Button variant="solid">solid</Button>
      <Button variant="primary">primary</Button>
      <Button variant="ghost">ghost</Button>
      <Button variant="subtle">subtle</Button>
      <Button variant="danger">danger</Button>
      <Button variant="none" className="ui-btn">
        none (with ui-btn)
      </Button>
      <Button size="sm">sm</Button>
      <Button size="lg">lg</Button>
      <Button size="icon" aria-label="Close">
        ×
      </Button>
      <Button loading>loading</Button>
      <Button variant="solid" disabled>
        solid (disabled)
      </Button>
    </div>
  ),
};
