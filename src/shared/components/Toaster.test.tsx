import { render, screen, act, waitFor } from "@testing-library/react";
import { Toast } from "@base-ui/react/toast";
import { describe, expect, it } from "vitest";
import {
  Toaster,
  toastManager,
  toastError,
  toastSuccess,
  toastLoading,
  toastClose,
  toastInfo,
  toastWarning,
  toastPromise,
} from "./Toaster";

function WithProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager}>
      {children}
      <Toaster />
    </Toast.Provider>
  );
}

const sel = {
  root: '[data-type]',
  close: '[class*="toastClose"]',
  action: '[class*="toastAction"]',
  spinner: 'svg.ui-spinner',
};

describe("Toaster (kit)", () => {
  it("renders a success toast", async () => {
    render(<WithProvider>{null}</WithProvider>);
    act(() => toastSuccess("Pushed", "main → origin/main"));
    await waitFor(() => {
      expect(document.body.querySelector(sel.root)).not.toBeNull();
    });
    const root = document.body.querySelector(sel.root);
    expect(root).toHaveAttribute("data-type", "success");
    expect(screen.getByText("Pushed")).toBeInTheDocument();
  });

  it("renders an error toast", async () => {
    render(<WithProvider>{null}</WithProvider>);
    act(() => toastError("Failed"));
    await waitFor(() => {
      expect(document.body.querySelector(sel.root)).not.toBeNull();
    });
    const root = document.body.querySelector(sel.root);
    expect(root).toHaveAttribute("data-type", "error");
  });

  it("renders an info toast", async () => {
    render(<WithProvider>{null}</WithProvider>);
    act(() => toastInfo("Note"));
    await waitFor(() => {
      expect(document.body.querySelector(sel.root)).not.toBeNull();
    });
    const root = document.body.querySelector(sel.root);
    expect(root).toHaveAttribute("data-type", "info");
  });

  it("renders a warning toast", async () => {
    render(<WithProvider>{null}</WithProvider>);
    act(() => toastWarning("Careful"));
    await waitFor(() => {
      expect(document.body.querySelector(sel.root)).not.toBeNull();
    });
    const root = document.body.querySelector(sel.root);
    expect(root).toHaveAttribute("data-type", "warning");
  });

  it("loading toast has the loading class applied", async () => {
    render(<WithProvider>{null}</WithProvider>);
    act(() => toastLoading("Working…"));
    await waitFor(() => {
      expect(document.body.querySelector(sel.root)).not.toBeNull();
    });
    const root = document.body.querySelector(sel.root) as HTMLElement;
    expect(root).toHaveAttribute("data-type", "loading");
    // CSS Modules hashes the class name; verify the toastRoot class is present.
    expect(root.className).toMatch(/toastRoot/);
  });

  it("loading toast renders a spinner", async () => {
    render(<WithProvider>{null}</WithProvider>);
    act(() => toastLoading("Working…"));
    await waitFor(() => {
      expect(document.body.querySelector(sel.spinner)).toBeInTheDocument();
    });
  });

  it("loading toast has NO close button (X)", async () => {
    render(<WithProvider>{null}</WithProvider>);
    act(() => toastLoading("Working…"));
    await waitFor(() => {
      expect(document.body.querySelector(sel.root)).toBeInTheDocument();
    });
    expect(document.body.querySelector(sel.close)).not.toBeInTheDocument();
  });

  it("loading toast renders an action button when provided", async () => {
    render(<WithProvider>{null}</WithProvider>);
    act(() =>
      toastLoading("Working…", { action: { label: "Cancel", onClick: () => {} } }),
    );
    await waitFor(() => {
      expect(document.body.querySelector(sel.action)).toBeInTheDocument();
    });
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("close() dismisses the toast", async () => {
    render(<WithProvider>{null}</WithProvider>);
    let id = "";
    act(() => {
      const handle = toastLoading("Working…");
      id = handle.id;
    });
    await waitFor(() => {
      expect(document.body.querySelector(sel.root)).toBeInTheDocument();
    });
    act(() => toastClose(id));
    await waitFor(() => {
      expect(document.body.querySelector(sel.root)).not.toBeInTheDocument();
    });
  });

  it("toastPromise shows loading, then flips to success on resolve", async () => {
    render(<WithProvider>{null}</WithProvider>);
    let resolveP: (v: unknown) => void;
    const promise = new Promise((r) => { resolveP = r; });
    act(() => {
      toastPromise(promise, {
        loading: "Saving…",
        success: "Saved",
        error: "Failed",
      });
    });
    // Loading state
    await waitFor(() => {
      const root = document.body.querySelector(sel.root);
      expect(root).toHaveAttribute("data-type", "loading");
    });
    expect(document.body.querySelector(sel.spinner)).toBeInTheDocument();
    // Resolve
    act(() => { resolveP!("done"); });
    await waitFor(() => {
      const root = document.body.querySelector(sel.root);
      expect(root).toHaveAttribute("data-type", "success");
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("toastPromise shows loading, then flips to error on reject", async () => {
    render(<WithProvider>{null}</WithProvider>);
    let rejectP: (e: Error) => void;
    const promise = new Promise((_, r) => { rejectP = r; });
    act(() => {
      toastPromise(promise, {
        loading: "Saving…",
        success: "Saved",
        error: "Failed",
      });
    });
    await waitFor(() => {
      const root = document.body.querySelector(sel.root);
      expect(root).toHaveAttribute("data-type", "loading");
    });
    act(() => { rejectP!(new Error("boom")); });
    await waitFor(() => {
      const root = document.body.querySelector(sel.root);
      expect(root).toHaveAttribute("data-type", "error");
    });
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
