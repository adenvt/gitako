import { ArrowDownIcon, ChevronDownIcon } from "@primer/octicons-react";
import { Menu } from "@base-ui/react/menu";
import { useRepoStore } from "@/state/store";
import { Button } from "@/shared/components/ui";
import type { PullMode } from "@/shared/types/git";
import s from "./PullMenu.module.css";

/**
 * Split button: left half does the default pull (fast-forward if possible,
 * otherwise merge); right half opens a dropdown with the other strategies.
 * Uses Base UI Menu with `modal={false}` so the toolbar stays clickable
 * while the menu is open.
 */
export function PullMenu() {
  const loading = useRepoStore((st) => st.loading);
  const pulling = useRepoStore((st) => st.pulling);
  const pullAction = useRepoStore((st) => st.pull);
  const fetchAction = useRepoStore((st) => st.fetch);

  const busy = loading || pulling;
  const label = pulling ? "pull…" : "pull";

  return (
    <div className={s.split}>
      <Button
        variant="solid"
        className={s.main}
        onClick={() => void pullAction("ff")}
        disabled={busy}
        title={pulling ? "Pulling…" : "Pull (fast-forward if possible)"}
      >
        <ArrowDownIcon size={13} aria-hidden />
        {label}
      </Button>
      <Menu.Root modal={false}>
        <Menu.Trigger
          aria-label="More pull options"
          title="More pull options"
          className={s.caret}
          disabled={busy}
        >
          <ChevronDownIcon size={12} aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={2} className={s.positioner}>
            <Menu.Popup className={s.popup} aria-label="Remote operations">
              <Menu.Item className={s.item} onClick={() => void fetchAction()}>
                Fetch all
              </Menu.Item>
              <Menu.Separator className={s.separator} />
              <Menu.Item className={s.item} onClick={() => void pullAction("ff")}>
                Pull (fast-forward if possible)
              </Menu.Item>
              <Menu.Item className={s.item} onClick={() => void pullAction("ffOnly")}>
                Pull (fast-forward only)
              </Menu.Item>
              <Menu.Item className={s.item} onClick={() => void pullAction("rebase")}>
                Pull (rebase)
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

// Re-export PullMode for convenience in tests.
export type { PullMode };
