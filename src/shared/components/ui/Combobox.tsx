import type { ComponentProps, ReactNode } from "react";
import clsx from "clsx";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";

export type ComboboxRootProps<V, M extends boolean | undefined = false> = ComponentProps<
  (typeof BaseCombobox)["Root"] & { value?: V; multiple?: M }
>;

/**
 * Base UI Combobox with the app's shared popup chrome.
 * Wraps @base-ui/react/combobox — use this instead of importing
 * `@base-ui/react/combobox` directly so the trigger / popup / item
 * styling stays consistent app-wide.
 *
 * Two visual anatomies are supported by the same namespace:
 *   - bare trigger (`Combobox.Trigger`) for a single-button trigger
 *     like BranchSwitcher.
 *   - bordered input + caret shell (`Combobox.InputGroup` +
 *     `Combobox.Input` + `Combobox.Trigger`) for the input group used
 *     by AiSettingsPage's model picker. The trigger inside the shell
 *     gets its chrome from the descendant rule `.ui-input-group > button`
 *     in base.css; do not pass a className to the shell trigger.
 */
export const Combobox = {
  ...BaseCombobox,
  Trigger: ({ className, ...props }: ComponentProps<typeof BaseCombobox.Trigger>) => (
    <BaseCombobox.Trigger className={clsx("ui-trigger-combobox", className)} {...props} />
  ),
  InputGroup: ({ className, ...props }: ComponentProps<typeof BaseCombobox.InputGroup>) => (
    <BaseCombobox.InputGroup className={clsx("ui-input-group", className)} {...props} />
  ),
  Input: ({ className, ...props }: ComponentProps<typeof BaseCombobox.Input>) => (
    <BaseCombobox.Input className={clsx("ui-input ui-input-flat", className)} {...props} />
  ),
  Portal: ({ className, ...props }: ComponentProps<typeof BaseCombobox.Portal>) => (
    <BaseCombobox.Portal
      {...props}
      render={<div className={clsx("ui-portal", className)} />}
    />
  ),
  Positioner: ({ className, ...props }: ComponentProps<typeof BaseCombobox.Positioner>) => (
    <BaseCombobox.Positioner className={clsx("ui-positioner", className)} {...props} />
  ),
  Popup: ({ className, children, ...props }: ComponentProps<typeof BaseCombobox.Popup>) => (
    <BaseCombobox.Popup className={clsx("ui-popup", className)} {...props}>
      {children as ReactNode}
    </BaseCombobox.Popup>
  ),
  Item: ({ className, ...props }: ComponentProps<typeof BaseCombobox.Item>) => (
    <BaseCombobox.Item className={clsx("ui-item", className)} {...props} />
  ),
  Empty: ({ className, ...props }: ComponentProps<typeof BaseCombobox.Empty>) => (
    <BaseCombobox.Empty className={clsx("ui-empty", className)} {...props} />
  ),
};
