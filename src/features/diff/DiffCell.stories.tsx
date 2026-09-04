import type { Meta, StoryObj } from "@storybook/react-vite";
import { Cell, ChangeCell } from "./DiffCell";
import s from "./diff.module.css";

const meta: Meta = {
  title: "Features/DiffCell",
  decorators: [
    (Story) => (
      <div
        style={{
          padding: 8,
          background: "var(--bg)",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj;

export const ContextLine: Story = {
  render: () => <Cell text="const x = 1;" num={null} tokens={null} />,
};

export const AddedLine: Story = {
  render: () => (
    <span className={s.diffRow}>
      <span className={s.diffNum}>+ 12</span>
      <Cell text="  const x = 42;" num={null} tokens={null} />
    </span>
  ),
};

export const RemovedLine: Story = {
  render: () => (
    <span className={s.diffRow}>
      <span className={s.diffNum}>- 12</span>
      <Cell text="  const x = 1;" num={null} tokens={null} />
    </span>
  ),
};

export const ChangedWords: Story = {
  render: () => (
    <ChangeCell
      text="  const greeting = 'hello';"
      num={null}
      kind="add"
      other="  const greeting = 'world';"
      tokens={null}
    />
  ),
};
