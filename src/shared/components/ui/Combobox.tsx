import { type ComponentProps, type ReactNode } from "react";
import clsx from "clsx";
import { CheckIcon } from "@primer/octicons-react";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { ScrollArea } from "./ScrollArea";

export type ComboboxRootProps = ComponentProps<typeof BaseCombobox.Root>;

/**
 * Base UI Combobox with the app's shared popup chrome.
 * Wraps @base-ui/react/combobox — use this instead of importing
 * `@base-ui/react/combobox` directly so the trigger / popup / item
 * styling stays consistent app-wide.
 *
 * Two ways to use it:
 *   - **Bare form** (default for new code): `<Combobox variant="trigger" | "input" options={…} />`
 *     renders Root + a trigger of the chosen variant + Popup + ScrollArea-wrapped List.
 *   - **Compound form** (for advanced cases): the `.Root` / `.Trigger` / `.InputGroup` /
 *     `.Input` / `.Portal` / `.Positioner` / `.Popup` / `.Item` / `.Empty` parts.
 *
 * The two visual anatomies mirror the two existing call sites:
 *   - `variant="trigger"` (bare caret trigger) — what `BranchSwitcher` uses.
 *   - `variant="input"` (bordered input + caret shell, default) — what `AiSettingsPage`
 *     uses. The trigger inside the shell gets its chrome from the descendant rule
 *     `.ui-input-group > button` in base.css; do not pass a className to the shell trigger.
 *
 * Bare-form API:
 *   - `variant: "trigger" | "input"` — defaults to `"input"`.
 *   - `options: { value: string; label: string }[]` — required list of choices.
 *   - `value` / `onValueChange` — controlled selection.
 *   - `placeholder` — shown in the trigger / input when nothing is selected.
 *   - `aria-labelledby` — forwarded to the trigger / input for label association.
 *   - `children` — **override slot**: if passed, replaces the default options.map
 *     inside the List. Lets advanced call sites keep full control.
 */
export type ComboboxWrapperProps = Omit<ComboboxRootProps, "children"> & {
  variant?: "trigger" | "input";
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** className applied to the trigger or input-group shell. */
  className?: string;
  /** Forwarded to the trigger or input for label association. */
  "aria-labelledby"?: string;
  /** Override slot — replaces the default options.map inside the List. */
  children?: ReactNode;
};

function findLabelForValue(
  options: { value: string; label: string }[] | undefined,
  value: unknown,
): string {
  if (value == null || !options) return "";
  const match = options.find((o) => o.value === value);
  return match?.label ?? "";
}

function ComboboxWrapper({
  variant = "input",
  options,
  value,
  onValueChange,
  placeholder,
  className,
  "aria-labelledby": labelledBy,
  ...props
}: ComboboxWrapperProps) {
  return (
    <BaseCombobox.Root
      value={value}
      onValueChange={onValueChange}
      items={options as never}
      // Resolve the selected value's label for the visible input. Without
      // this, Base UI's `stringifyAsLabel` only returns the raw value for
      // primitive selections, so the input shows "cherry" instead of "Cherry".
      // For object items Base UI's default `stringifyAsLabel` reads `.label`,
      // but our `value` is a primitive (the option's `value` field), so we
      // need this lookup explicitly.
      itemToStringLabel={(item) => {
        if (item == null) return "";
        if (typeof item === "object" && "label" in (item as Record<string, unknown>)) {
          return String((item as { label: string }).label);
        }
        return findLabelForValue(options, item);
      }}
      {...props}
    >
      {variant === "trigger" ? (
        <Combobox.Trigger aria-labelledby={labelledBy} className={className}>
          <Combobox.Value placeholder={placeholder} />
          <Combobox.Icon>▾</Combobox.Icon>
        </Combobox.Trigger>
      ) : (
        <Combobox.InputGroup className={className}>
          <Combobox.Input placeholder={placeholder} aria-labelledby={labelledBy} />
          <Combobox.Trigger>▾</Combobox.Trigger>
        </Combobox.InputGroup>
      )}
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup>
            {variant === "trigger" && (
              <Combobox.Input
                placeholder={placeholder ?? "Filter…"}
                aria-label="Filter options"
              />
            )}
            <ScrollArea style={{ flex: "1 1 auto", minHeight: 0 }}>
              <ScrollArea.Viewport>
                {/* Function-child pattern: lets Base UI use the items it has
                    in context for filtering and label resolution. Plain JSX
                    children break the filter (see working AiSettingsPage). */}
                <Combobox.List>
                  {(item: { value: string; label: string }) => (
                    <Combobox.Item key={item.value} value={item.value}>
                      <Combobox.ItemIndicator render={<CheckIcon size={12} aria-hidden />} />
                      {item.label}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar>
                <ScrollArea.Thumb />
              </ScrollArea.Scrollbar>
            </ScrollArea>
            <Combobox.Empty>No matches</Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </BaseCombobox.Root>
  );
}

type ComboboxCompound = {
  Root: typeof BaseCombobox.Root;
  Trigger: (props: ComponentProps<typeof BaseCombobox.Trigger>) => React.JSX.Element;
  InputGroup: (props: ComponentProps<typeof BaseCombobox.InputGroup>) => React.JSX.Element;
  Input: (props: ComponentProps<typeof BaseCombobox.Input>) => React.JSX.Element;
  Portal: (props: ComponentProps<typeof BaseCombobox.Portal>) => React.JSX.Element;
  Positioner: typeof BaseCombobox.Positioner;
  Popup: (props: ComponentProps<typeof BaseCombobox.Popup>) => React.JSX.Element;
  Item: (props: ComponentProps<typeof BaseCombobox.Item>) => React.JSX.Element;
  Empty: (props: ComponentProps<typeof BaseCombobox.Empty>) => React.JSX.Element;
  // Re-exported for ergonomic access on the compound.
  Value: typeof BaseCombobox.Value;
  Icon: typeof BaseCombobox.Icon;
  List: typeof BaseCombobox.List;
  ItemIndicator: typeof BaseCombobox.ItemIndicator;
  Group: typeof BaseCombobox.Group;
  GroupLabel: typeof BaseCombobox.GroupLabel;
  Arrow: typeof BaseCombobox.Arrow;
  Backdrop: typeof BaseCombobox.Backdrop;
  Separator: typeof BaseCombobox.Separator;
  Clear: typeof BaseCombobox.Clear;
  Chips: typeof BaseCombobox.Chips;
  Chip: typeof BaseCombobox.Chip;
  ChipRemove: typeof BaseCombobox.ChipRemove;
  Status: typeof BaseCombobox.Status;
  Collection: typeof BaseCombobox.Collection;
  Row: typeof BaseCombobox.Row;
  Label: typeof BaseCombobox.Label;
};

const ComboboxObject: ComboboxCompound = {
  Root: BaseCombobox.Root,
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
    <BaseCombobox.Portal {...props} render={<div className={clsx("ui-portal", className)} />} />
  ),
  Positioner: BaseCombobox.Positioner,
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
  Value: BaseCombobox.Value,
  Icon: BaseCombobox.Icon,
  List: BaseCombobox.List,
  ItemIndicator: BaseCombobox.ItemIndicator,
  Group: BaseCombobox.Group,
  GroupLabel: BaseCombobox.GroupLabel,
  Arrow: BaseCombobox.Arrow,
  Backdrop: BaseCombobox.Backdrop,
  Separator: BaseCombobox.Separator,
  Clear: BaseCombobox.Clear,
  Chips: BaseCombobox.Chips,
  Chip: BaseCombobox.Chip,
  ChipRemove: BaseCombobox.ChipRemove,
  Status: BaseCombobox.Status,
  Collection: BaseCombobox.Collection,
  Row: BaseCombobox.Row,
  Label: BaseCombobox.Label,
};

export const Combobox = ComboboxWrapper as typeof ComboboxWrapper & ComboboxCompound;
Object.assign(Combobox, ComboboxObject);
