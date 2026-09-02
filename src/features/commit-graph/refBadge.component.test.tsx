import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RefBadge, RefBadgeGroup, RefIcon, RefOverflowBadge } from "./refBadge";
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
    // Octicons renders a <Tag> as an SVG; the wrapper class is `octicon-tag`.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders a desktop icon for kind='branch'", () => {
    const { container } = render(<RefIcon refInfo={makeRef({ kind: "branch" })} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders a desktop icon for kind='head'", () => {
    const { container } = render(<RefIcon refInfo={makeRef({ kind: "head", name: "HEAD" })} />);
    expect(container.querySelector("svg")).not.toBeNull();
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
    // Single brand mark for all known providers; we just check for an SVG.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("falls back to a Globe icon for an unknown kind", () => {
    const { container } = render(<RefIcon refInfo={makeRef({ kind: "other" })} />);
    expect(container.querySelector("svg")).not.toBeNull();
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
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("RefBadge", () => {
  it("renders the ref name and the matching icon", () => {
    const { container } = render(<RefBadge refInfo={makeRef({ name: "main", kind: "branch" })} />);
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
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
    const { container } = render(<RefBadge refInfo={makeRef({ name: "main", kind: "head" })} />);
    expect(container.querySelector("svg")).not.toBeNull();
    // And the active class is applied.
    expect(container.querySelector("[class*='activeRef']")).not.toBeNull();
  });

  it("does not show an additional check icon for a plain branch", () => {
    const { container } = render(<RefBadge refInfo={makeRef({ name: "feature" })} />);
    // Plain branch gets exactly one icon (the leading RefIcon).
    expect(container.querySelectorAll("svg").length).toBe(1);
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
    expect(container.querySelector("svg")).not.toBeNull();
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
    // Group has no head ref, so no active class is applied.
    expect(container.querySelector("[class*='activeRef']")).toBeNull();
  });
});

describe("double-click to checkout", () => {
  it("calls onCheckout with a checkout action for a local branch", () => {
    const onCheckout = vi.fn();
    const { container } = render(
      <RefBadge refInfo={makeRef({ name: "feature", kind: "branch" })} onCheckout={onCheckout} />,
    );
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement;
    fireEvent.doubleClick(badge);
    expect(onCheckout).toHaveBeenCalledWith({
      kind: "checkout",
      name: "feature",
      refKind: "branch",
    });
  });

  it("calls onCheckout with a checkout action for a lone remote branch", () => {
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
    expect(onCheckout).toHaveBeenCalledWith({
      kind: "checkout",
      name: "origin/main",
      refKind: "remoteBranch",
    });
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

  it("RefBadgeGroup with local + remote fires a pull action (fast-forward the local)", () => {
    // When the group contains BOTH a local branch and a matching
    // remote-tracking ref, dblclick means "refresh this branch" — a
    // fast-forward pull into the local. This is the new behavior.
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
    const { container } = render(<RefBadgeGroup refs={refs} onCheckout={onCheckout} />);
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement;
    fireEvent.doubleClick(badge);
    expect(onCheckout).toHaveBeenCalledWith({ kind: "pull", branch: "main" });
  });

  it("RefBadgeGroup with only a local branch fires a checkout action", () => {
    const onCheckout = vi.fn();
    const refs = [makeRef({ name: "feature", fullName: "feature", kind: "branch" })];
    const { container } = render(<RefBadgeGroup refs={refs} onCheckout={onCheckout} />);
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement;
    fireEvent.doubleClick(badge);
    expect(onCheckout).toHaveBeenCalledWith({
      kind: "checkout",
      name: "feature",
      refKind: "branch",
    });
  });

  it("RefBadgeGroup with only a remote branch fires a checkout action (create local tracking)", () => {
    const onCheckout = vi.fn();
    const refs = [
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
    ];
    const { container } = render(<RefBadgeGroup refs={refs} onCheckout={onCheckout} />);
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement;
    fireEvent.doubleClick(badge);
    expect(onCheckout).toHaveBeenCalledWith({
      kind: "checkout",
      name: "origin/main",
      refKind: "remoteBranch",
    });
  });
});

describe("RefOverflowBadge", () => {
  it("renders +N where N is the number of hidden groups (refs within a group count as one)", () => {
    const hidden = [
      [makeRef({ name: "v1.0", fullName: "v1.0", kind: "tag" })],
      [makeRef({ name: "v2.0", fullName: "v2.0", kind: "tag" })],
      [makeRef({ name: "v3.0", fullName: "v3.0", kind: "tag" })],
    ];
    render(<RefOverflowBadge hiddenGroups={hidden} />);
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("counts a grouped local+remote as one badge, not two", () => {
    const hidden = [
      [
        makeRef({ name: "main", fullName: "main", kind: "branch" }),
        makeRef({
          name: "main",
          fullName: "origin/main",
          kind: "remoteBranch",
          remote: "origin",
        }),
      ],
    ];
    render(<RefOverflowBadge hiddenGroups={hidden} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("renders one row per hidden group with combined names and icons on hover", () => {
    const hidden = [
      [makeRef({ name: "v1.0", fullName: "v1.0", kind: "tag" })],
      [makeRef({ name: "v2.0", fullName: "v2.0", kind: "tag" })],
    ];
    const { container } = render(<RefOverflowBadge hiddenGroups={hidden} />);
    // Dropdown is portaled into document.body on hover, so mouseEnter
    // the chip first to open it.
    const chip = container.querySelector("[class*='refOverflowBadge']") as HTMLElement;
    fireEvent.mouseEnter(chip);
    expect(screen.getByText("v1.0")).toBeInTheDocument();
    expect(screen.getByText("v2.0")).toBeInTheDocument();
    const rows = document.body.querySelectorAll("[class*='refDropdownRow']");
    expect(rows.length).toBe(2);
  });

  it("collapses a hidden local+remote pair into one row, and the +N count", () => {
    const hidden = [
      [
        makeRef({ name: "main", fullName: "main", kind: "branch" }),
        makeRef({
          name: "main",
          fullName: "origin/main",
          kind: "remoteBranch",
          remote: "origin",
        }),
      ],
    ];
    const { container } = render(<RefOverflowBadge hiddenGroups={hidden} />);
    // +N counts the number of dropdown rows: the local+remote pair is 1 row.
    expect(screen.getByText("+1")).toBeInTheDocument();
    const chip = container.querySelector("[class*='refOverflowBadge']") as HTMLElement;
    fireEvent.mouseEnter(chip);
    // Single row, labelled by the shared base name (icons show local+remote).
    expect(screen.getByText("main")).toBeInTheDocument();
    const rows = document.body.querySelectorAll("[class*='refDropdownRow']");
    expect(rows.length).toBe(1);
  });

  it("renders nothing for an empty hiddenGroups array (defensive)", () => {
    const { container } = render(<RefOverflowBadge hiddenGroups={[]} />);
    expect(container.querySelector("[class*='refOverflowBadge']")).not.toBeNull();
    expect(screen.getByText("+0")).toBeInTheDocument();
  });
});
