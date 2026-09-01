import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useRepoStore } from "@/state/store";
import s from "./BranchSwitcher.module.css";

/**
 * Local-branch dropdown. Click the trigger to open, click a branch to
 * select, click outside or press Escape to close. Remote branches and
 * tags are intentionally hidden — those land in follow-up PRs.
 */
export function BranchSwitcher() {
  const refs = useRepoStore((st) => st.refs);
  const checkout = useRepoStore((st) => st.checkout);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const commits = useRepoStore((st) => st.commits);
  const current = useMemo(() => {
    const headHash = commits[0]?.hash;
    const head = headHash
      ? refs.find((r) => r.kind === "branch" && r.commit === headHash)
      : undefined;
    return head?.name ?? "detached HEAD";
  }, [refs, commits]);

  const branches = useMemo(
    () =>
      refs
        .filter((r) => r.kind === "branch")
        .map((r) => r.name),
    [refs],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (name: string) => {
    setOpen(false);
    if (name === current) return;
    void checkout(name).catch(() => {
      // store already set `error`; UI reads it. nothing to do.
    });
  };

  return (
    <div className={s.root} ref={rootRef}>
      <button
        type="button"
        className={s.trigger}
        data-open={open || undefined}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current branch: ${current}. Open branch switcher.`}
        title={current}
      >
        on {current}
        <ChevronDown size={12} aria-hidden />
      </button>
      {open && (
        <ul className={s.menu} role="listbox" aria-label="Branches">
          {branches.length === 0 ? (
            <li className={s.empty}>No local branches</li>
          ) : (
            branches.map((name) => {
              const isCurrent = name === current;
              return (
                <li
                  key={name}
                  role="option"
                  aria-selected={isCurrent}
                  aria-current={isCurrent ? "true" : undefined}
                  className={clsx(s.item, isCurrent && s.itemCurrent)}
                  onClick={() => pick(name)}
                  title={name}
                >
                  <Check size={12} className={s.check} aria-hidden />
                  {name}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
