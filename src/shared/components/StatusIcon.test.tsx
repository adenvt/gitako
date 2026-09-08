import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusIcon } from "./StatusIcon";

describe("StatusIcon", () => {
  it("renders an icon for status \"A\" (added)", () => {
    const { container } = render(<StatusIcon status="A" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders an icon for status \"D\" (deleted)", () => {
    const { container } = render(<StatusIcon status="D" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders an icon for status \"R\" (renamed)", () => {
    const { container } = render(<StatusIcon status="R" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders an icon for status \"C\" (copied)", () => {
    const { container } = render(<StatusIcon status="C" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders an icon for status \"M\" (modified)", () => {
    const { container } = render(<StatusIcon status="M" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders an icon for unknown status (default)", () => {
    const { container } = render(<StatusIcon status="?" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("applies statusAdded class for status \"A\"", () => {
    const { container } = render(<StatusIcon status="A" />);
    const svg = container.querySelector("svg")!;
    expect(svg.className).toMatch(/statusAdded/);
  });

  it("applies statusDeleted class for status \"D\"", () => {
    const { container } = render(<StatusIcon status="D" />);
    const svg = container.querySelector("svg")!;
    expect(svg.className).toMatch(/statusDeleted/);
  });

  it("lowercase status works (case-insensitive)", () => {
    const { container } = render(<StatusIcon status="a" />);
    const svg = container.querySelector("svg")!;
    expect(svg.className).toMatch(/statusAdded/);
  });

  it("always applies treeStatusIcon base class", () => {
    const { container } = render(<StatusIcon status="M" />);
    const svg = container.querySelector("svg")!;
    expect(svg.className).toMatch(/treeStatusIcon/);
  });

  it("renders at 14px size", () => {
    const { container } = render(<StatusIcon status="M" />);
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("width")).toBe("14");
  });
});
