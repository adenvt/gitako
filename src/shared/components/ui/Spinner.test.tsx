import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./Spinner";

describe("Spinner (kit)", () => {
  it("applies the ui-spinner class", () => {
    const { container } = render(<Spinner />);
    const el = container.querySelector("svg.ui-spinner");
    expect(el).toBeInTheDocument();
  });

  it("renders an SVG with the expected viewBox", () => {
    const { container } = render(<Spinner />);
    const el = container.querySelector("svg");
    expect(el).toBeInTheDocument();
    expect(el?.getAttribute("viewBox")).toBe("0 0 16 16");
  });

  it("defaults to size 13 (md)", () => {
    const { container } = render(<Spinner />);
    const el = container.querySelector("svg");
    expect(el?.getAttribute("width")).toBe("13");
    expect(el?.getAttribute("height")).toBe("13");
  });

  it("renders sm size (12px)", () => {
    const { container } = render(<Spinner size="sm" />);
    const el = container.querySelector("svg");
    expect(el?.getAttribute("width")).toBe("12");
  });

  it("renders lg size (16px)", () => {
    const { container } = render(<Spinner size="lg" />);
    const el = container.querySelector("svg");
    expect(el?.getAttribute("width")).toBe("16");
  });

  it("is aria-hidden (decorative)", () => {
    const { container } = render(<Spinner />);
    const el = container.querySelector("svg");
    expect(el?.getAttribute("aria-hidden")).toBe("true");
  });
});
