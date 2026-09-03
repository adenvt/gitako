import { useMemo } from "react";
import { CheckIcon, ChevronDownIcon } from "@primer/octicons-react";
import { Combobox, ScrollArea } from "@/shared/components/ui";
import { useRepoStore } from "@/state/store";
import s from "./BranchSwitcher.module.css";

/**
 * Local-branch dropdown with search. Click the trigger to open a popup
 * with a filter input; type to narrow, arrow + Enter to pick, Escape or
 * click outside to dismiss. Picking a different local branch calls
 * `checkout(name)`. Remote branches and tags are intentionally hidden —
 * those land in follow-up PRs.
 */
export function BranchSwitcher() {
  const refs = useRepoStore((st) => st.refs);
  const checkout = useRepoStore((st) => st.checkout);
  const headBranch = useRepoStore((st) => st.headBranch);

  // `headBranch` is set by the store from `git symbolic-ref --short HEAD`
  // (or a short hash for detached HEAD). It's authoritative — don't infer
  // from the log because topo order doesn't guarantee HEAD is first.
  const current = headBranch ?? "detached HEAD";

  const branches = useMemo(
    // The backend marks the current branch with `kind: "head"` (rather than
    // `"branch"`) so the graph can show a "you are here" check on it.
    // We need both kinds here so the current branch is in the list and
    // the ItemIndicator has a matching item to render the check next to.
    () => refs.filter((r) => r.kind === "branch" || r.kind === "head").map((r) => r.name),
    [refs],
  );

  return (
    <Combobox.Root<string>
      items={branches}
      // Pin the combobox's selection to the current branch so the
      // ItemIndicator (the check icon) auto-renders next to it.
      value={headBranch ?? null}
      onValueChange={(name) => {
        if (!name || name === headBranch) return;
        void checkout(name).catch(() => {
          // store already set `error`; UI reads it. nothing to do.
        });
      }}
    >
      <Combobox.Trigger
        className={s.trigger}
        aria-label={`Current branch: ${current}. Open branch switcher.`}
        title={current}
      >
        on {current}
        <ChevronDownIcon size={12} aria-hidden />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={2}>
          <Combobox.Popup aria-label="Branches">
            <Combobox.Input
              placeholder="Filter branches…"
              aria-label="Filter branches"
            />
            <ScrollArea.Root style={{ flex: "1 1 auto", minHeight: 0 }}>
              <ScrollArea.Viewport>
                <Combobox.List>
                  {(branch: string) => (
                    <Combobox.Item key={branch} value={branch}>
                      <Combobox.ItemIndicator
                        render={<CheckIcon size={12} aria-hidden />}
                      />
                      <span>{branch}</span>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar>
                <ScrollArea.Thumb />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
            <Combobox.Empty>
              {branches.length === 0 ? "No local branches" : "No branches match"}
            </Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
