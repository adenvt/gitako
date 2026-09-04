import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Combobox } from "./Combobox";

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

const meta: Meta<typeof Combobox> = {
  title: "UI Kit/Combobox",
  component: Combobox,
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["trigger", "input"],
      description:
        "'trigger' = bare caret (BranchSwitcher). 'input' = bordered input-group (AiSettingsPage).",
    },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
  args: {
    variant: "input",
    options: FRUITS,
    placeholder: "Search…",
  },
};

export default meta;

type Story = StoryObj<typeof Combobox>;

export const TriggerDefault: Story = {
  args: { variant: "trigger" },
};

export const InputDefault: Story = {
  args: { variant: "input" },
};

export const WithSelection: Story = {
  args: { variant: "input" },
  render: (args) => {
    const [value, setValue] = useState<string>("cherry");
    return (
      <div>
        <label id="fruit-label" style={{ display: "block", marginBottom: 4 }}>
          Fruit
        </label>
        <Combobox
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
  args: { variant: "trigger", options: [], placeholder: "No options" },
};

export const LongList: Story = {
  render: (args) => {
    const [value, setValue] = useState<string>("item-7");
    return (
      <div>
        <label id="long-label" style={{ display: "block", marginBottom: 4 }}>
          Item
        </label>
        <Combobox
          {...args}
          variant="input"
          options={LONG_LIST}
          aria-labelledby="long-label"
          value={value}
          onValueChange={(v) => setValue(v as string)}
          placeholder="Search 30 items…"
        />
      </div>
    );
  },
};
