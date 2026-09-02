import { useMemo } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Combobox } from "@base-ui/react/combobox";
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
        <ChevronDown size={12} className={s.triggerIcon} aria-hidden />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={2} className={s.positioner}>
          <Combobox.Popup className={s.popup} aria-label="Branches">
            <div className={s.inputGroup}>
              <Combobox.Input
                placeholder="Filter branches…"
                className={s.input}
                aria-label="Filter branches"
              />
            </div>
            <Combobox.List className={s.list}>
              {(branch: string) => (
                <Combobox.Item key={branch} value={branch} className={s.item}>
                  <Combobox.ItemIndicator
                    keepMounted
                    className={s.itemIndicator}
                    render={<Check size={12} aria-hidden />}
                  />
                  <span>{branch}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
            <Combobox.Empty className={s.empty}>
              {branches.length === 0 ? "No local branches" : "No branches match"}
            </Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
