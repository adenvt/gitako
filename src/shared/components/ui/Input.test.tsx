import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input (kit)", () => {
  it("applies the ui-input class", () => {
    render(<Input placeholder="x" />);
    expect(screen.getByPlaceholderText("x").className).toMatch(/ui-input/);
  });

  it("merges a caller className with ui-input", () => {
    render(<Input placeholder="x" className="my-class" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.className).toMatch(/ui-input/);
    expect(el.className).toMatch(/my-class/);
  });

  it("forwards value as empty string by default", () => {
    render(<Input placeholder="x" value="" onChange={() => {}} />);
    const el = screen.getByPlaceholderText("x") as HTMLInputElement;
    expect(el.value).toBe("");
  });

  it("forwards disabled", () => {
    render(<Input placeholder="x" disabled />);
    expect(screen.getByPlaceholderText("x")).toBeDisabled();
  });

  it("forwards type=password", () => {
    render(<Input placeholder="x" type="password" />);
    expect(screen.getByPlaceholderText("x")).toHaveAttribute("type", "password");
  });

  it("forwards aria-invalid (Base UI contract)", () => {
    render(<Input placeholder="x" aria-invalid="true" />);
    expect(screen.getByPlaceholderText("x")).toHaveAttribute("aria-invalid", "true");
  });
});
