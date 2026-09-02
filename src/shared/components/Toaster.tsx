import { Toast } from "@base-ui/react/toast";
import { XIcon } from "@primer/octicons-react";
import s from "./toaster.module.css";

/**
 * Global toast manager, usable outside the React tree (store actions).
 * Passed to <Toast.Provider toastManager={...}> so every toast shows in the
 * same viewport.
 */
export const toastManager = Toast.createToastManager();

/** Fire an error toast for a failed action. */
export function toastError(title: string, description?: string): void {
  toastManager.add({ type: "error", title, description, priority: "high" });
}

/** Fire a success toast for a completed action. */
export function toastSuccess(title: string, description?: string): void {
  toastManager.add({ type: "success", title, description });
}

/** Options for a loading toast — the long-running in-flight indicator
 *  with an optional action button (e.g. "Cancel"). */
export interface ToastLoadingOptions {
  description?: string;
  /** Inline action rendered into the toast (a button). Use for "Cancel",
   *  "Retry", etc. The toast stays open until the caller calls `close()`. */
  action?: { label: string; onClick: () => void };
}

/** Returned by `toastLoading` so the caller can close the toast or
 *  swap its state once the work resolves/rejects. */
export interface ToastLoadingHandle {
  id: string;
  close: () => void;
  /** Update the toast in place (e.g. flip `type` to "error" on failure). */
  update: (patch: { title?: string; description?: string; type?: string }) => void;
}

/** Fire a non-auto-dismissing loading toast and return a handle so the
 *  caller can close it (or flip its state) when the work resolves. The
 *  optional `action` renders a button on the toast — used by the AI
 *  generate flow to let the user cancel a slow request. */
export function toastLoading(title: string, opts: ToastLoadingOptions = {}): ToastLoadingHandle {
  const id = toastManager.add({
    type: "loading",
    title,
    description: opts.description,
    // Never auto-dismiss; the caller closes it when the work resolves.
    timeout: 0,
    actionProps: opts.action
      ? { children: opts.action.label, onClick: opts.action.onClick }
      : undefined,
  });
  return {
    id,
    close: () => toastManager.close(id),
    update: (patch) => toastManager.update(id, patch),
  };
}

/** Dismiss a toast by id. Thin wrapper for call sites that don't need
 *  the rest of the loading handle. */
export function toastClose(id: string): void {
  toastManager.close(id);
}

/** App-wide toast viewport. Mount once near the app root. */
export function Toaster() {
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal>
      <Toast.Viewport className={s.toastViewport}>
        {toasts.map((toast) => (
          <Toast.Root key={toast.id} toast={toast} className={s.toastRoot}>
            <div className={s.toastBody}>
              {toast.title && <Toast.Title className={s.toastTitle}>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description className={s.toastDescription}>
                  {toast.description}
                </Toast.Description>
              )}
            </div>
            {toast.actionProps && (
              <Toast.Action className={s.toastAction} {...toast.actionProps} />
            )}
            <Toast.Close className={s.toastClose} aria-label="Dismiss">
              <XIcon size={14} aria-hidden />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
