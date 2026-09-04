import { type ComponentProps, type ReactNode } from "react";
import clsx from "clsx";
import { CheckIcon } from "@primer/octicons-react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { ScrollArea } from "./ScrollArea";

export type SelectRootProps = ComponentProps<typeof BaseSelect.Root>;

/**
 * Base UI Select with the app's shared popup chrome.
 * Wraps @base-ui/react/select — use this instead of importing
 * `@base-ui/react/select` directly so the trigger / popup / item styling
 * stays consistent app-wide.
 *
 * Two ways to use it:
 *   - **Bare form** (default for new code): `<Select options={…} value onValueChange placeholder />`
 *     renders Root + Trigger + Portal + Positioner + Popup + ScrollArea-wrapped List.
 *   - **Compound form** (for advanced cases): the `.Root` / `.Trigger` / `.Portal` /
 *     `.Positioner` / `.Popup` / `.Item` parts. Use this when you need grouped
 *     items, icons per row, or a custom `Select.ItemIndicator`.
 *
 * Bare-form API:
 *   - `options: { value: string; label: string }[]` — required list of choices.
 *   - `value` / `onValueChange` — controlled selection (BaseSelect's standard pair).
 *   - `placeholder` — shown in the trigger when nothing is selected.
 *   - `aria-labelledby` — forwarded to the trigger for label association.
 *   - `children` — **override slot**: if passed, replaces the default `options.map`
 *     inside the List. Lets advanced call sites keep full control without dropping
 *     out of the bare wrapper.
 */
export type SelectWrapperProps = Omit<SelectRootProps, "children"> & {
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** className applied to the trigger. */
  className?: string;
  /** Forwarded to the trigger for label association. */
  "aria-labelledby"?: string;
  /** Override slot — replaces the default options.map inside the List. */
  children?: ReactNode;
};

function SelectWrapper({
  options,
  value,
  onValueChange,
  placeholder,
  children,
  className,
  "aria-labelledby": labelledBy,
  ...props
}: SelectWrapperProps) {
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={onValueChange}
      items={options as never}
      {...props}
    >
      <Select.Trigger aria-labelledby={labelledBy} className={className}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon>▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} alignItemWithTrigger={false}>
          <Select.Popup>
            <ScrollArea style={{ flex: "1 1 auto", minHeight: 0 }}>
              <ScrollArea.Viewport>
                <Select.List>
                  {children ??
                    options?.map((o) => (
                      <Select.Item key={o.value} value={o.value}>
                        <Select.ItemIndicator render={<CheckIcon size={12} aria-hidden />} />
                        <Select.ItemText>{o.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                </Select.List>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar>
                <ScrollArea.Thumb />
              </ScrollArea.Scrollbar>
            </ScrollArea>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </BaseSelect.Root>
  );
}

type SelectCompound = {
  Root: typeof BaseSelect.Root;
  Trigger: (props: ComponentProps<typeof BaseSelect.Trigger>) => React.JSX.Element;
  Portal: (props: ComponentProps<typeof BaseSelect.Portal>) => React.JSX.Element;
  Positioner: (props: ComponentProps<typeof BaseSelect.Positioner>) => React.JSX.Element;
  Popup: (props: ComponentProps<typeof BaseSelect.Popup>) => React.JSX.Element;
  Item: (props: ComponentProps<typeof BaseSelect.Item>) => React.JSX.Element;
  // Re-exported from BaseSelect for ergonomic access on the compound.
  Value: typeof BaseSelect.Value;
  Icon: typeof BaseSelect.Icon;
  List: typeof BaseSelect.List;
  ItemText: typeof BaseSelect.ItemText;
  ItemIndicator: typeof BaseSelect.ItemIndicator;
  Group: typeof BaseSelect.Group;
  GroupLabel: typeof BaseSelect.GroupLabel;
  Arrow: typeof BaseSelect.Arrow;
  Backdrop: typeof BaseSelect.Backdrop;
  ScrollDownArrow: typeof BaseSelect.ScrollDownArrow;
  ScrollUpArrow: typeof BaseSelect.ScrollUpArrow;
  Separator: typeof BaseSelect.Separator;
};

const SelectObject: SelectCompound = {
  Root: BaseSelect.Root,
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
  Value: BaseSelect.Value,
  Icon: BaseSelect.Icon,
  List: BaseSelect.List,
  ItemText: BaseSelect.ItemText,
  ItemIndicator: BaseSelect.ItemIndicator,
  Group: BaseSelect.Group,
  GroupLabel: BaseSelect.GroupLabel,
  Arrow: BaseSelect.Arrow,
  Backdrop: BaseSelect.Backdrop,
  ScrollDownArrow: BaseSelect.ScrollDownArrow,
  ScrollUpArrow: BaseSelect.ScrollUpArrow,
  Separator: BaseSelect.Separator,
};

export const Select = SelectWrapper as typeof SelectWrapper & SelectCompound;
Object.assign(Select, SelectObject);
