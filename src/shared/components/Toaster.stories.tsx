import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toast } from "@base-ui/react/toast";
import { Toaster, toastManager, toastSuccess, toastError, toastLoading, toastClose } from "./Toaster";

function WithProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager}>
      <div style={{ position: "relative", minHeight: 200 }}>{children}</div>
      <Toaster />
    </Toast.Provider>
  );
}

const meta: Meta = {
  title: "Components/Toaster",
  decorators: [
    (Story) => (
      <WithProvider>
        <Story />
      </WithProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj;

export const Success: Story = {
  render: () => (
    <button
      className="ui-btn ui-btn-primary"
      onClick={() => toastSuccess("Pushed", "main → origin/main")}
    >
      Fire success toast
    </button>
  ),
};

export const Error: Story = {
  render: () => (
    <button
      className="ui-btn"
      onClick={() => toastError("Push failed", "Permission denied (publickey)")}
    >
      Fire error toast
    </button>
  ),
};

export const Loading: Story = {
  render: () => {
    let lastId: string | null = null;
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="ui-btn"
          onClick={() => {
            const handle = toastLoading("Generating commit message…", {
              description: "Calling OpenAI",
              action: { label: "Cancel", onClick: () => toastClose(handle.id) },
            });
            lastId = handle.id;
          }}
        >
          Start loading toast
        </button>
        <button
          className="ui-ghost"
          onClick={() => {
            if (lastId) toastClose(lastId);
          }}
        >
          Close last
        </button>
      </div>
    );
  },
};
