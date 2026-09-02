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
            <Toast.Close className={s.toastClose} aria-label="Dismiss">
              <XIcon size={14} aria-hidden />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
