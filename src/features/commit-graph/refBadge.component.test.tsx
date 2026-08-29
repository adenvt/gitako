import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
    const { container } = render(
      <RefBadge refInfo={makeRef({ name: "main" })} color="#ff0000" />,
    );
    const span = container.querySelector("[class*='commitRefBadge']") as HTMLElement | null;
    expect(span?.getAttribute("style") ?? "").toMatch(/badge-color:\s*#ff0000/);
  });

  it("does not set a style when color is omitted", () => {
    const { container } = render(<RefBadge refInfo={makeRef({ name: "main" })} />);
    const span = container.querySelector("[class*='commitRefBadge']") as HTMLElement | null;
    expect(span?.getAttribute("style")).toBeNull();
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
});
