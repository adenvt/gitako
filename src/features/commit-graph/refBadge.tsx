import { Globe, Laptop, Tag } from "lucide-react";
import { SiBitbucket, SiGithub, SiGitlab } from "react-icons/si";
import type { RefInfo } from "@/shared/types/git";

/** Detect the hosting provider from a remote URL (https or ssh). */
export type RefProvider = "github" | "gitlab" | "bitbucket" | null;

export function providerFromUrl(url: string | null | undefined): RefProvider {
  if (!url) return null;
  if (url.includes("github.com") || url.includes("github.")) return "github";
  if (url.includes("gitlab.com") || url.includes("gitlab.")) return "gitlab";
  if (url.includes("bitbucket.org") || url.includes("bitbucket.")) return "bitbucket";
  return null;
}

const BRAND_ICONS: Record<Exclude<RefProvider, null>, typeof SiGithub> = {
  github: SiGithub,
  gitlab: SiGitlab,
  bitbucket: SiBitbucket,
};

interface RefIconProps {
  refInfo: RefInfo;
}

/** The leading icon for one ref: laptop (local), brand (remote), tag, globe (other). */
export function RefIcon({ refInfo }: RefIconProps) {
  const { kind, remoteUrl } = refInfo;
  switch (kind) {
    case "remoteBranch": {
      const provider = providerFromUrl(remoteUrl);
      const Icon = provider ? BRAND_ICONS[provider] : Globe;
      return <Icon size={11} aria-hidden />;
    }
    case "tag":
      return <Tag size={11} aria-hidden />;
    case "branch":
    case "head":
      return <Laptop size={11} aria-hidden />;
    default:
      return <Globe size={11} aria-hidden />;
  }
}

/** Full display name for a ref: remote branch -> `origin/main`, else `name`. */
export function refFullName(refInfo: RefInfo): string {
  const { name, kind, remote } = refInfo;
  return kind === "remoteBranch" && remote ? `${remote}/${name}` : name;
}

interface RefBadgeProps {
  refInfo: RefInfo;
}

/** A single ref badge (used when refs have distinct names). */
export function RefBadge({ refInfo }: RefBadgeProps) {
  const fullName = refFullName(refInfo);
  return (
    <span className="commit-ref-badge" title={fullName}>
      <span className="ref-name">{refInfo.name}</span>
      <RefIcon refInfo={refInfo} />
    </span>
  );
}

interface RefBadgeGroupProps {
  /** Refs sharing the same base name (e.g. `main` + `origin/main`). */
  refs: RefInfo[];
}

/**
 * One badge for a group of refs with the same base name. Shows the shared
 * name plus one icon per ref; hovering reveals a dropdown with each ref's
 * full name and provider.
 */
export function RefBadgeGroup({ refs }: RefBadgeGroupProps) {
  const name = refs[0]?.name ?? "";
  const label = refs.map(refFullName).join(", ");
  return (
    <span className="commit-ref-badge ref-badge-group" title={label}>
      <span className="ref-name">{name}</span>
      <span className="ref-group-icons">
        {refs.map((r) => (
          <RefIcon key={r.fullName} refInfo={r} />
        ))}
      </span>
      <span className="ref-dropdown">
        {refs.map((r) => (
          <span key={r.fullName} className="ref-dropdown-item">
            <RefIcon refInfo={r} />
            <span className="ref-dropdown-name">{refFullName(r)}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
