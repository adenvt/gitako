import type { Meta, StoryObj } from "@storybook/react-vite";
import { RefBadge, RefBadgeGroup, RefOverflowBadge, RefIcon } from "./refBadge";
import type { RefInfo } from "@/shared/types/git";

const localBranch: RefInfo = {
  name: "main",
  fullName: "main",
  kind: "branch",
  target: "abc1234",
  commit: "abc1234",
  remote: null,
  remoteUrl: null,
};
const remoteBranch: RefInfo = {
  name: "main",
  fullName: "origin/main",
  kind: "remoteBranch",
  target: "abc1234",
  commit: "abc1234",
  remote: "origin",
  remoteUrl: "https://github.com/foo/bar.git",
};
const head: RefInfo = {
  name: "HEAD",
  fullName: "HEAD -> main",
  kind: "head",
  target: "abc1234",
  commit: "abc1234",
  remote: null,
  remoteUrl: null,
};
const tag: RefInfo = {
  name: "v1.0.0",
  fullName: "v1.0.0",
  kind: "tag",
  target: "abc1234",
  commit: "abc1234",
  remote: null,
  remoteUrl: null,
};

const meta: Meta = {
  title: "Features/RefBadge",
  decorators: [
    (Story) => (
      <div
        style={{
          padding: 16,
          background: "var(--bg-raised)",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj;

export const Single: Story = {
  render: () => (
    <>
      <RefBadge refInfo={localBranch} color="#7ec07c" />
      <RefBadge refInfo={remoteBranch} color="#61afef" />
      <RefBadge refInfo={head} color="#e5c07b" />
      <RefBadge refInfo={tag} color="#c678dd" />
    </>
  ),
};

export const Icons: Story = {
  render: () => (
    <>
      <RefIcon refInfo={localBranch} />
      <RefIcon refInfo={remoteBranch} />
      <RefIcon refInfo={tag} />
      <RefIcon refInfo={head} />
    </>
  ),
};

export const Group: Story = {
  render: () => (
    <RefBadgeGroup refs={[head, localBranch]} color="#7ec07c" />
  ),
};

export const Overflow: Story = {
  render: () => (
    <RefOverflowBadge
      hiddenGroups={[
        [remoteBranch],
        [tag],
        [{ ...tag, name: "v1.0.1" }],
      ]}
      color="#999"
    />
  ),
};
