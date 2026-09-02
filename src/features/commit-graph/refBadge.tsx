import {
  CheckIcon,
  DeviceDesktopIcon,
  GlobeIcon,
  MarkGithubIcon,
  TagIcon,
} from "@primer/octicons-react";
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

interface RefBadgeProps {
  refInfo: RefInfo;
  /** Lane color of the commit, used to tint the badge to match the node. */
  color?: string;
  /**
   * Called on double-click. Receives the name to pass to `git checkout`
   * (a local branch name) and the kind so the store can route remote
   * refs to `git checkout --track` automatically.
   */
  onCheckout?: (name: string, kind: "branch" | "remoteBranch") => void;
}

/** A single ref badge (used when refs have distinct names). */
export function RefBadge({ refInfo, color, onCheckout }: RefBadgeProps) {
  const fullName = refFullName(refInfo);
  const canCheckout =
    onCheckout && (refInfo.kind === "branch" || refInfo.kind === "remoteBranch");
  const handleDoubleClick = canCheckout
    ? () => {
        // Remote branches are addressed by their full `origin/feature`
        // name; the store routes them to `checkoutTrack` based on kind.
        const name = refInfo.kind === "remoteBranch" ? fullName : refInfo.name;
        const kind = refInfo.kind === "remoteBranch" ? "remoteBranch" : "branch";
        onCheckout(name, kind);
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
   * Called on double-click. Prefers the local branch (plain `git checkout`);
   * falls back to the remote-tracking ref's full name (`origin/feature`).
   */
  onCheckout?: (name: string, kind: "branch" | "remoteBranch") => void;
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
  const handleDoubleClick =
    onCheckout && (localBranch || remoteBranch)
      ? () => {
          if (localBranch) {
            onCheckout(localBranch.name, "branch");
          } else if (remoteBranch) {
            onCheckout(refFullName(remoteBranch), "remoteBranch");
          }
        }
      : undefined;
  return (
    <span
      className={clsx(s.commitRefBadge, s.refBadgeGroup, isActive && s.activeRef)}
      title={label}
      style={color ? ({ "--badge-color": color } as React.CSSProperties) : undefined}
      onDoubleClick={handleDoubleClick}
    >
      {isActive && <CheckIcon size={11} className={s.activeRefCheck} aria-hidden />}
      <span className={s.refName}>{name}</span>
      <span className={s.refGroupIcons}>
        {refs.map((r) => (
          <RefIcon key={r.fullName} refInfo={r} />
        ))}
      </span>
      <span className={s.refDropdown}>
        {refs.map((r) => (
          <span key={r.fullName} className={s.refDropdownItem}>
            <RefIcon refInfo={r} />
            <span className={s.refDropdownName}>{refFullName(r)}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
