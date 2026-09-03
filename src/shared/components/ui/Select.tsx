import type { ComponentProps, ReactNode } from "react";
import clsx from "clsx";
import { Select as BaseSelect } from "@base-ui/react/select";

export type SelectRootProps<V, M extends boolean | undefined = false> = ComponentProps<
  (typeof BaseSelect)["Root"] & { value?: V; multiple?: M }
>;

/**
 * Base UI Select with the app's shared popup chrome.
 * Wraps @base-ui/react/select — use this instead of importing
 * `@base-ui/react/select` directly so the trigger / popup / item styling
 * stays consistent app-wide.
 */
export const Select = {
  ...BaseSelect,
  Trigger: ({ className, ...props }: ComponentProps<typeof BaseSelect.Trigger>) => (
    <BaseSelect.Trigger className={clsx("ui-trigger-select", className)} {...props} />
  ),
  Portal: ({ className, ...props }: ComponentProps<typeof BaseSelect.Portal>) => (
    <BaseSelect.Portal {...props} render={<div className={clsx("ui-portal", className)} />} />
  ),
  Positioner: ({ className, ...props }: ComponentProps<typeof BaseSelect.Positioner>) => (
    <BaseSelect.Positioner className={clsx("ui-positioner", className)} {...props} />
  ),
  Popup: ({ className, children, ...props }: ComponentProps<typeof BaseSelect.Popup>) => (
    <BaseSelect.Popup className={clsx("ui-popup", className)} {...props}>
      {children as ReactNode}
    </BaseSelect.Popup>
  ),
  Item: ({ className, ...props }: ComponentProps<typeof BaseSelect.Item>) => (
    <BaseSelect.Item className={clsx("ui-item", className)} {...props} />
  ),
};
