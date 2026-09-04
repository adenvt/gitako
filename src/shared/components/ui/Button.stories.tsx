import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "UI Kit/Button",
  component: Button,
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["solid", "primary", "ghost", "none"],
      description: "Visual style. 'none' keeps only caller classes.",
    },
    disabled: { control: "boolean" },
    children: { control: "text" },
  },
  args: {
    variant: "solid",
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

export const Disabled: Story = {
  args: { disabled: true, children: "Disabled" },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button variant="solid">solid</Button>
      <Button variant="primary">primary</Button>
      <Button variant="ghost">ghost</Button>
      <Button variant="none" className="ui-btn">
        none (with ui-btn)
      </Button>
      <Button variant="solid" disabled>
        solid (disabled)
      </Button>
    </div>
  ),
};
