import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileTree } from "./FileTree";
import { buildFileTree } from "@/shared/utils/fileTree";

const SMALL_ENTRIES = [
  { path: "README.md", status: "M" },
  { path: "src/index.ts", status: "A" },
  { path: "src/utils/helper.ts", status: "D" },
];

const NESTED_ENTRIES = [
  { path: "package.json", status: "M" },
  { path: "src/components/Button.tsx", status: "A" },
  { path: "src/components/Button.module.css", status: "A" },
  { path: "src/utils/format.ts", status: "M" },
  { path: "src/utils/parse.ts", status: "D" },
  { path: "src/hooks/useThing.ts", status: "A" },
  { path: "docs/README.md", status: "M" },
];

const meta: Meta<typeof FileTree> = {
  title: "Components/FileTree",
  component: FileTree,
  decorators: [
    (Story) => (
      <div style={{ width: 360, height: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof FileTree>;

export const Small: Story = {
  args: { root: buildFileTree(SMALL_ENTRIES) },
};

export const Nested: Story = {
  args: { root: buildFileTree(NESTED_ENTRIES) },
};

export const AllActions: Story = {
  args: {
    root: buildFileTree(SMALL_ENTRIES),
    actionLabel: "stage",
    actionVariant: "stage",
    onFileAction: () => {},
    onFileOpen: () => {},
  },
};
