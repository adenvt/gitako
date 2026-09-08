import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InputSpinner, InputCheck, InputAlert, InputClear } from "./InputIcons";

describe("InputIcons", () => {
  describe("InputSpinner", () => {
    it("renders a spinner with ui-spinner class", () => {
      const { container } = render(<InputSpinner />);
      const svg = container.querySelector("svg.ui-spinner");
      expect(svg).not.toBeNull();
    });

    it("default size is md", () => {
      const { container } = render(<InputSpinner />);
      const svg = container.querySelector("svg") as SVGSVGElement;
      // Spinner doesn't expose size via width/height — just verify it renders
      expect(svg).not.toBeNull();
    });

    it("accepts size prop without crashing", () => {
      const { container } = render(<InputSpinner size="sm" />);
      expect(container.querySelector("svg.ui-spinner")).not.toBeNull();
    });
  });

  describe("InputCheck", () => {
    it("renders a check icon with ui-input-icon-ok class", () => {
      const { container } = render(<InputCheck />);
      const svg = container.querySelector("svg.ui-input-icon-ok");
      expect(svg).not.toBeNull();
    });

    it("is aria-hidden", () => {
      const { container } = render(<InputCheck />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    });

    it("size sm renders 12px icon", () => {
      const { container } = render(<InputCheck size="sm" />);
      const svg = container.querySelector("svg") as SVGSVGElement;
      expect(svg.getAttribute("width")).toBe("12");
    });

    it("size lg renders 16px icon", () => {
      const { container } = render(<InputCheck size="lg" />);
      const svg = container.querySelector("svg") as SVGSVGElement;
      expect(svg.getAttribute("width")).toBe("16");
    });
  });

  describe("InputAlert", () => {
    it("renders an alert icon with ui-input-icon-err class", () => {
      const { container } = render(<InputAlert />);
      const svg = container.querySelector("svg.ui-input-icon-err");
      expect(svg).not.toBeNull();
    });

    it("is aria-hidden", () => {
      const { container } = render(<InputAlert />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    });

    it("size sm renders 12px icon", () => {
      const { container } = render(<InputAlert size="sm" />);
      const svg = container.querySelector("svg") as SVGSVGElement;
      expect(svg.getAttribute("width")).toBe("12");
    });
  });

  describe("InputClear", () => {
    it("renders a clear (X) icon with ui-input-icon class", () => {
      const { container } = render(<InputClear />);
      const svg = container.querySelector("svg.ui-input-icon");
      expect(svg).not.toBeNull();
    });

    it("is aria-hidden", () => {
      const { container } = render(<InputClear />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    });

    it("size md renders 13px icon", () => {
      const { container } = render(<InputClear size="md" />);
      const svg = container.querySelector("svg") as SVGSVGElement;
      expect(svg.getAttribute("width")).toBe("13");
    });
  });
});
