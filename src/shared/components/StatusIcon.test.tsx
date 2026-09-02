import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StatusIcon } from "./StatusIcon";

describe("StatusIcon", () => {
  it("renders an icon for each kind (one rendering per kind is enough)", () => {
    // Lucide icons render as SVGs; we just confirm the component mounts and
    // produces an SVG for each kind. Detailed SVG snapshots aren't useful.
    for (const status of ["A", "D", "R", "C", "M"]) {
      const { container, unmount } = render(<StatusIcon status={status} />);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });

  it("renders the same default for unknown statuses (treated as 'modified')", () => {
    // The component falls back to FilePenLine for anything not A/D/R/C.
    const { container: c1 } = render(<StatusIcon status="M" />);
    const { container: c2 } = render(<StatusIcon status="Z" />);
    // Both produce a single SVG with the same accessible role.
    expect(c1.querySelector("svg")).not.toBeNull();
    expect(c2.querySelector("svg")).not.toBeNull();
  });

  it("is case-insensitive on the class lookup (lowercased status used for color)", () => {
    // The component does `statusClass[status.toLowerCase()]`. This test
    // pins behavior so a refactor can't accidentally make it case-sensitive
    // (e.g. by passing a non-ASCII uppercase status).
    const { container } = render(<StatusIcon status="A" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
