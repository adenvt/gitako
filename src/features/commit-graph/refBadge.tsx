import {
  CheckIcon,
  DeviceDesktopIcon,
  GlobeIcon,
  MarkGithubIcon,
  TagIcon,
} from "@primer/octicons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { RefInfo } from "@/shared/types/git";
import s from "./refBadge.module.css";

/** Detect the hosting provider from a remote URL (https or ssh). */
export type RefProvider = "github" | "gitlab" | "bitbucket" | null;

export function providerFromUrl(url: string | null | undefined): RefProvider {
  if (!url) return null;
  if (url.includes("github.com") || url.includes("github.")) return "github";
  if (url.includes("gitlab.com") || url.includes("gitlab.")) return "gitlab";
  if (url.includes("bitbucket.org") || url.includes("bitbucket.")) return "bitbucket";
  return null;
}

// Octicons ships a single GitHub mark; we keep the provider detection
// around for downstream consumers (sorting, future brand-specific UI) but
// render a single brand mark for all three and a globe for everything else.
function BrandIcon() {
  return <MarkGithubIcon size={11} aria-hidden />;
}

interface RefIconProps {
  refInfo: RefInfo;
}

/** The leading icon for one ref: laptop (local), brand (remote), tag, globe (other). */
export function RefIcon({ refInfo }: RefIconProps) {
  const { kind, remoteUrl } = refInfo;
  switch (kind) {
    case "remoteBranch": {
      const provider = providerFromUrl(remoteUrl);
      return provider ? <BrandIcon /> : <GlobeIcon size={11} aria-hidden />;
    }
    case "tag":
      return <TagIcon size={11} aria-hidden />;
    case "branch":
    case "head":
      return <DeviceDesktopIcon size={11} aria-hidden />;
    default:
      return <GlobeIcon size={11} aria-hidden />;
  }
}

/** Full display name for a ref: remote branch -> `origin/main`, else `name`. */
export function refFullName(refInfo: RefInfo): string {
  const { name, kind, remote } = refInfo;
  return kind === "remoteBranch" && remote ? `${remote}/${name}` : name;
}

/** What the caller should do on double-click. Discriminated so the
 *  badge can ask for either a plain checkout (remote-only: create the
 *  local tracking branch) or a fast-forward pull into an existing
 *  local branch. */
export type CheckoutAction =
  | {
      kind: "checkout";
      /** Name to pass to `git checkout`. For remote refs this is the
       *  full `origin/feature` form so the store can route to
       *  `checkout --track`. */
      name: string;
      refKind: "branch" | "remoteBranch";
    }
  | {
      kind: "pull";
      /** Local branch to fast-forward-pull. The store is responsible
       *  for moving onto this branch first. */
      branch: string;
    };

/** Renders `children` into a portal positioned below `anchor` on hover.
 *  The small open/close delay prevents flicker when the cursor crosses
 *  the 1px gap between the anchor and the dropdown. Position is read from
 *  the anchor's bounding rect (so the dropdown escapes any `overflow:hidden`
 *  ancestor — important in the virtualized commit list where rows are
 *  absolutely positioned and clipped). */
function HoverDropdown({
  anchor,
  open,
  color,
  children,
}: {
  anchor: HTMLElement | null;
  open: boolean;
  /** Lane color passed through to the portaled dropdown so the row tint
   *  matches the badge that opened it (the portal lives in document.body
   *  and can't inherit the badge's CSS custom property). */
  color?: string;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!open || !anchor) return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      setPos({ left: r.left, top: r.bottom + 1 });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchor]);
  if (!open || !pos) return null;
  return createPortal(
    <div
      className={s.refDropdownPortal}
      style={{
        left: pos.left,
        top: pos.top,
        ...(color ? ({ "--badge-color": color } as React.CSSProperties) : {}),
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

interface RefBadgeProps {
  refInfo: RefInfo;
  /** Lane color of the commit, used to tint the badge to match the node. */
  color?: string;
  /**
   * Called on double-click. For a local branch or a lone remote ref
   * the action is `checkout`; the store routes remote refs to
   * `checkout --track` automatically. (Pulling is only meaningful
   * when the badge is part of a group that contains a matching local
   * branch — see `RefBadgeGroup`.)
   */
  onCheckout?: (action: CheckoutAction) => void;
}

/** A single ref badge (used when refs have distinct names). */
export function RefBadge({ refInfo, color, onCheckout }: RefBadgeProps) {
  const fullName = refFullName(refInfo);
  const canCheckout = onCheckout && (refInfo.kind === "branch" || refInfo.kind === "remoteBranch");
  const handleDoubleClick = canCheckout
    ? () => {
        // Remote branches are addressed by their full `origin/feature`
        // name; the store routes them to `checkoutTrack` based on kind.
        const name = refInfo.kind === "remoteBranch" ? fullName : refInfo.name;
        const refKind = refInfo.kind === "remoteBranch" ? "remoteBranch" : "branch";
        onCheckout({ kind: "checkout", name, refKind });
      }
    : undefined;
  return (
    <span
      className={clsx(s.commitRefBadge, refInfo.kind === "head" && s.activeRef)}
      title={fullName}
      style={color ? ({ "--badge-color": color } as React.CSSProperties) : undefined}
      onDoubleClick={handleDoubleClick}
    >
      {refInfo.kind === "head" && <CheckIcon size={11} className={s.activeRefCheck} aria-hidden />}
      <span className={s.refName}>{refInfo.name}</span>
      <RefIcon refInfo={refInfo} />
    </span>
  );
}

interface RefBadgeGroupProps {
  /** Refs sharing the same base name (e.g. `main` + `origin/main`). */
  refs: RefInfo[];
  /** Lane color of the commit, used to tint the badge to match the node. */
  color?: string;
  /**
   * Called on double-click. When the group contains BOTH a local
   * branch and a matching remote, the action is `pull` (fast-forward
   * the local branch into its upstream). Otherwise it falls back to
   * `checkout` — local branch (plain checkout) or remote-only
   * (create the local tracking branch).
   */
  onCheckout?: (action: CheckoutAction) => void;
}

/**
 * One badge for a group of refs with the same base name. Shows the shared
 * name plus one icon per ref; hovering reveals a dropdown with each ref's
 * full name and provider.
 */
export function RefBadgeGroup({ refs, color, onCheckout }: RefBadgeGroupProps) {
  const name = refs[0]?.name ?? "";
  const label = refs.map(refFullName).join(", ");
  const isActive = refs.some((r) => r.kind === "head");
  const localBranch = refs.find((r) => r.kind === "branch");
  const remoteBranch = refs.find((r) => r.kind === "remoteBranch");
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const scheduleOpen = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 100);
  };
  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);
  const handleDoubleClick =
    onCheckout && (localBranch || remoteBranch)
      ? () => {
          // If the group has BOTH a local and a remote for the same
          // name, dblclick = pull the local forward (the common
          // "refresh this branch" gesture). Otherwise fall back to
          // checkout — local-only (switch) or remote-only (track).
          if (localBranch && remoteBranch) {
            onCheckout({ kind: "pull", branch: localBranch.name });
          } else if (localBranch) {
            onCheckout({ kind: "checkout", name: localBranch.name, refKind: "branch" });
          } else if (remoteBranch) {
            onCheckout({
              kind: "checkout",
              name: refFullName(remoteBranch),
              refKind: "remoteBranch",
            });
          }
        }
      : undefined;
  return (
    <span
      ref={ref}
      className={clsx(s.commitRefBadge, s.refBadgeGroup, isActive && s.activeRef)}
      title={label}
      style={color ? ({ "--badge-color": color } as React.CSSProperties) : undefined}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      {isActive && <CheckIcon size={11} className={s.activeRefCheck} aria-hidden />}
      <span className={s.refName}>{name}</span>
      <span className={s.refGroupIcons}>
        {refs.map((r) => (
          <RefIcon key={r.fullName} refInfo={r} />
        ))}
      </span>
      <HoverDropdown anchor={ref.current} open={open} color={color}>
        <div className={s.refDropdownRow} title={label}>
          <span className={s.refDropdownName}>{label}</span>
          <span className={s.refGroupIcons}>
            {refs.map((r) => (
              <RefIcon key={r.fullName} refInfo={r} />
            ))}
          </span>
        </div>
      </HoverDropdown>
    </span>
  );
}

interface RefOverflowBadgeProps {
  /** Groups of refs that were hidden behind this chip. Each inner array is one
   *  group (e.g. `[main, origin/main]`); the dropdown renders one item per ref. */
  hiddenGroups: RefInfo[][];
  /** Lane color of the commit; unused for the chip itself (it stays muted)
   *  but accepted for symmetry with the other badge components. */
  color?: string;
}

/**
 * Expand a group of refs into the rows it should render as in a dropdown.
 * A group that contains BOTH a local `branch` and a matching `remoteBranch`
 * (same `name`) collapses into one row — that's the local+remote-tracking
 * pair, which the badge chrome already represents as a single grouped
 * badge. Other groups (or groups with a single ref) render one row per ref.
 */
function expandGroupToRows(group: RefInfo[]): RefInfo[][] {
  const local = group.find((r) => r.kind === "branch");
  const remote = group.find((r) => r.kind === "remoteBranch" && r.name === local?.name);
  if (local && remote) {
    return [[local, remote]];
  }
  return group.map((r) => [r]);
}

/** Row label for a dropdown row. A collapsed local+remote pair shares one
 *  base name; any other row is a single ref, labelled by its full name (so a
 *  lone `origin/feature` keeps its remote prefix). */
function rowLabel(row: RefInfo[]): string {
  const local = row.find((r) => r.kind === "branch");
  if (local) return local.name;
  return row.map(refFullName).join(", ");
}

/**
 * Overflow chip shown when a commit has more badges than fit. Displays `+N`
 * (where N is the number of dropdown rows the chip will reveal) and shows a
 * portaled dropdown on hover. Local+remote pairs collapse into one row with
 * both icons; other refs each get their own row. Not a checkout target.
 */
export function RefOverflowBadge({ hiddenGroups, color }: RefOverflowBadgeProps) {
  const rows = hiddenGroups.flatMap(expandGroupToRows);
  const count = rows.length;
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const scheduleOpen = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 100);
  };
  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);
  return (
    <span
      ref={ref}
      className={clsx(s.commitRefBadge, s.refOverflowBadge)}
      style={color ? ({ "--badge-color": color } as React.CSSProperties) : undefined}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      +{count}
      <HoverDropdown anchor={ref.current} open={open} color={color}>
        {rows.map((row, i) => (
          <div
            key={row.map((r) => r.fullName).join("|") || i}
            className={s.refDropdownRow}
            title={row.map(refFullName).join(", ")}
          >
            <span className={s.refDropdownName}>{rowLabel(row)}</span>
            <span className={s.refGroupIcons}>
              {row.map((r) => (
                <RefIcon key={r.fullName} refInfo={r} />
              ))}
            </span>
          </div>
        ))}
      </HoverDropdown>
    </span>
  );
}
