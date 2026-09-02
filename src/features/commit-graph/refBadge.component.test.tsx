import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RefBadge, RefBadgeGroup, RefIcon } from "./refBadge";
import type { RefInfo } from "@/shared/types/git";

function makeRef(overrides: Partial<RefInfo>): RefInfo {
  return {
    name: "main",
    fullName: "main",
    kind: "branch",
    target: "x",
    commit: "x",
    remote: null,
    remoteUrl: null,
    ...overrides,
  };
}

describe("RefIcon", () => {
  it("renders a tag icon for kind='tag'", () => {
    const { container } = render(<RefIcon refInfo={makeRef({ kind: "tag" })} />);
    // lucide-react renders a <Tag> as an SVG with the class `lucide-tag`.
    expect(container.querySelector("svg.lucide-tag")).not.toBeNull();
  });

  it("renders a laptop icon for kind='branch'", () => {
    const { container } = render(<RefIcon refInfo={makeRef({ kind: "branch" })} />);
    expect(container.querySelector("svg.lucide-laptop")).not.toBeNull();
  });

  it("renders a laptop icon for kind='head'", () => {
    const { container } = render(<RefIcon refInfo={makeRef({ kind: "head", name: "HEAD" })} />);
    expect(container.querySelector("svg.lucide-laptop")).not.toBeNull();
  });

  it("renders a brand icon for kind='remoteBranch' with a known provider URL", () => {
    const { container } = render(
      <RefIcon
        refInfo={makeRef({
          kind: "remoteBranch",
          remote: "origin",
          remoteUrl: "https://github.com/foo/bar.git",
        })}
      />,
    );
    // SiGithub renders as an SVG with class `lucide-github` or the
    // simple-icons version; we just check for an SVG.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("falls back to a Globe icon for an unknown kind", () => {
    const { container } = render(<RefIcon refInfo={makeRef({ kind: "other" })} />);
    expect(container.querySelector("svg.lucide-globe")).not.toBeNull();
  });

  it("falls back to a Globe icon for a remoteBranch with no recognized provider URL", () => {
    const { container } = render(
      <RefIcon
        refInfo={makeRef({
          kind: "remoteBranch",
          remote: "self",
          remoteUrl: "https://git.example.com/foo.git",
        })}
      />,
    );
    expect(container.querySelector("svg.lucide-globe")).not.toBeNull();
  });
});

describe("RefBadge", () => {
  it("renders the ref name and the matching icon", () => {
    const { container } = render(<RefBadge refInfo={makeRef({ name: "main", kind: "branch" })} />);
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-laptop")).not.toBeNull();
  });

  it("uses the ref's fullName as the title (hover tooltip)", () => {
    const { container } = render(
      <RefBadge
        refInfo={makeRef({
          name: "main",
          fullName: "origin/main",
          kind: "remoteBranch",
          remote: "origin",
        })}
      />,
    );
    const span = container.querySelector("[title]") as HTMLElement | null;
    expect(span?.getAttribute("title")).toBe("origin/main");
  });

  it("applies the optional color as a CSS custom property", () => {
    const { container } = render(<RefBadge refInfo={makeRef({ name: "main" })} color="#ff0000" />);
    const span = container.querySelector("[class*='commitRefBadge']") as HTMLElement | null;
    expect(span?.getAttribute("style") ?? "").toMatch(/badge-color:\s*#ff0000/);
  });

  it("does not set a style when color is omitted", () => {
    const { container } = render(<RefBadge refInfo={makeRef({ name: "main" })} />);
    const span = container.querySelector("[class*='commitRefBadge']") as HTMLElement | null;
    expect(span?.getAttribute("style")).toBeNull();
  });

  it("shows a check icon for the current branch (kind='head')", () => {
    const { container } = render(
      <RefBadge refInfo={makeRef({ name: "main", kind: "head" })} />,
    );
    expect(container.querySelector("svg.lucide-check")).not.toBeNull();
    // And the active class is applied.
    expect(container.querySelector("[class*='activeRef']")).not.toBeNull();
  });

  it("does not show a check icon for a plain branch", () => {
    const { container } = render(<RefBadge refInfo={makeRef({ name: "feature" })} />);
    expect(container.querySelector("svg.lucide-check")).toBeNull();
  });
});

describe("RefBadgeGroup", () => {
  it("renders a single shared name + one icon per ref", () => {
    const refs = [
      makeRef({ name: "main", fullName: "main", kind: "branch" }),
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
    ];
    const { container } = render(<RefBadgeGroup refs={refs} />);
    // Exactly one "main" label visible (the shared name); the other matches
    // come from the hidden dropdown.
    const visible = screen.getAllByText("main");
    expect(visible.length).toBeGreaterThanOrEqual(1);
    // Two icons in the group.
    const groupIcons = container.querySelectorAll("[class*='refGroupIcons'] svg");
    expect(groupIcons.length).toBe(2);
  });

  it("renders the comma-joined full names as the title (hover tooltip)", () => {
    const refs = [
      makeRef({ name: "main", fullName: "main", kind: "branch" }),
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
    ];
    const { container } = render(<RefBadgeGroup refs={refs} />);
    const titleEl = container.querySelector("[title]") as HTMLElement | null;
    expect(titleEl?.getAttribute("title")).toBe("main, origin/main");
  });

  it("renders an empty name when refs is empty (defensive)", () => {
    const { container } = render(<RefBadgeGroup refs={[]} />);
    // The component falls back to an empty string for the label.
    expect(container.querySelector("[class*='commitRefBadge']")).not.toBeNull();
  });

  it("shows a check icon when the group contains the current branch (kind='head')", () => {
    const refs = [
      makeRef({ name: "main", fullName: "main", kind: "head" }),
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
    ];
    const { container } = render(<RefBadgeGroup refs={refs} />);
    expect(container.querySelector("svg.lucide-check")).not.toBeNull();
  });

  it("does not show a check icon when no ref in the group is the head", () => {
    const refs = [
      makeRef({ name: "main", fullName: "main", kind: "branch" }),
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
    ];
    const { container } = render(<RefBadgeGroup refs={refs} />);
    expect(container.querySelector("svg.lucide-check")).toBeNull();
  });
});

describe("double-click to checkout", () => {
  it("calls onCheckout with the local branch name + kind on double-click", () => {
    const onCheckout = vi.fn();
    const { container } = render(
      <RefBadge refInfo={makeRef({ name: "feature", kind: "branch" })} onCheckout={onCheckout} />,
    );
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement;
    fireEvent.doubleClick(badge);
    expect(onCheckout).toHaveBeenCalledWith("feature", "branch");
  });

  it("calls onCheckout with the full name and remoteBranch kind for a remote branch", () => {
    const onCheckout = vi.fn();
    const { container } = render(
      <RefBadge
        refInfo={makeRef({
          name: "main",
          fullName: "origin/main",
          kind: "remoteBranch",
          remote: "origin",
        })}
        onCheckout={onCheckout}
      />,
    );
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement;
    fireEvent.doubleClick(badge);
    expect(onCheckout).toHaveBeenCalledWith("origin/main", "remoteBranch");
  });

  it("does not call onCheckout for a tag", () => {
    const onCheckout = vi.fn();
    const { container } = render(
      <RefBadge refInfo={makeRef({ name: "v1.0", kind: "tag" })} onCheckout={onCheckout} />,
    );
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement;
    fireEvent.doubleClick(badge);
    expect(onCheckout).not.toHaveBeenCalled();
  });

  it("does not call onCheckout when the prop is omitted", () => {
    const { container } = render(
      <RefBadge refInfo={makeRef({ name: "feature", kind: "branch" })} />,
    );
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement;
    // No throw is enough; the handler is not wired.
    expect(() => fireEvent.doubleClick(badge)).not.toThrow();
  });

  it("RefBadgeGroup fires onCheckout with the local branch name", () => {
    const onCheckout = vi.fn();
    const refs = [
      makeRef({ name: "main", fullName: "main", kind: "branch" }),
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
    ];
    const { container } = render(
      <RefBadgeGroup refs={refs} onCheckout={onCheckout} />,
    );
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement;
    fireEvent.doubleClick(badge);
    expect(onCheckout).toHaveBeenCalledWith("main", "branch");
  });

  it("RefBadgeGroup falls back to the remote branch's full name when no local branch is in the group", () => {
    const onCheckout = vi.fn();
    const refs = [
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
    ];
    const { container } = render(
      <RefBadgeGroup refs={refs} onCheckout={onCheckout} />,
    );
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement;
    fireEvent.doubleClick(badge);
    expect(onCheckout).toHaveBeenCalledWith("origin/main", "remoteBranch");
  });
});
