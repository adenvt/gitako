import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Select } from "./Select";

const FRUITS = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
  { value: "durian", label: "Durian" },
];

const LONG_LIST = Array.from({ length: 30 }, (_, i) => ({
  value: `item-${i}`,
  label: `Item ${i + 1}`,
}));

const meta: Meta<typeof Select> = {
  title: "UI Kit/Select",
  component: Select,
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
  args: {
    options: FRUITS,
    placeholder: "Pick a fruit…",
  },
};

export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {};

export const WithSelection: Story = {
  render: (args) => {
    const [value, setValue] = useState<string>("banana");
    return (
      <div>
        <label id="fruit-label" style={{ display: "block", marginBottom: 4 }}>
          Fruit
        </label>
        <Select
          {...args}
          aria-labelledby="fruit-label"
          value={value}
          onValueChange={(v) => setValue(v as string)}
        />
      </div>
    );
  },
};

export const Empty: Story = {
  args: { options: [], placeholder: "No options" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const LongList: Story = {
  args: { options: LONG_LIST, placeholder: "Scroll to find one…" },
};
