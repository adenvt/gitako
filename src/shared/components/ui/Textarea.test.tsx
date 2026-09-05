import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Textarea } from "./Textarea";

describe("Textarea (kit)", () => {
  it("applies the ui-textarea class", () => {
    render(<Textarea placeholder="x" />);
    expect(screen.getByPlaceholderText("x").className).toMatch(/ui-textarea/);
  });

  it("merges a caller className with ui-textarea", () => {
    render(<Textarea placeholder="x" className="my-class" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.className).toMatch(/ui-textarea/);
    expect(el.className).toMatch(/my-class/);
  });

  it("renders as a <textarea> element (not <input>)", () => {
    const { container } = render(<Textarea placeholder="x" />);
    expect(container.querySelector("textarea")).toBeInTheDocument();
    expect(container.querySelector("input")).not.toBeInTheDocument();
  });

  it("forwards disabled", () => {
    render(<Textarea placeholder="x" disabled />);
    expect(screen.getByPlaceholderText("x")).toBeDisabled();
  });

  it("forwards rows", () => {
    render(<Textarea placeholder="x" rows={6} />);
    expect(screen.getByPlaceholderText("x")).toHaveAttribute("rows", "6");
  });

  it("forwards value", () => {
    render(<Textarea value="hello" onChange={() => {}} />);
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("applies ui-textarea-sm when size='sm'", () => {
    render(<Textarea placeholder="x" size="sm" />);
    expect(screen.getByPlaceholderText("x").className).toMatch(/ui-textarea-sm/);
  });

  it("applies ui-textarea-lg when size='lg'", () => {
    render(<Textarea placeholder="x" size="lg" />);
    expect(screen.getByPlaceholderText("x").className).toMatch(/ui-textarea-lg/);
  });

  it("omits size class when size='md' (default)", () => {
    render(<Textarea placeholder="x" />);
    expect(screen.getByPlaceholderText("x").className).not.toMatch(/ui-textarea-(sm|lg)/);
  });

  it("state='invalid' applies ui-textarea-invalid and aria-invalid", () => {
    render(<Textarea placeholder="x" state="invalid" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.className).toMatch(/ui-textarea-invalid/);
    expect(el).toHaveAttribute("aria-invalid", "true");
  });

  it("clearable shows the clear button when value is non-empty", () => {
    const { container } = render(
      <Textarea value="abc" clearable onChange={() => {}} />,
    );
    expect(container.querySelector(".ui-textarea-clear")).toBeInTheDocument();
  });

  it("clearable hides the clear button when value is empty", () => {
    const { container } = render(
      <Textarea value="" clearable onChange={() => {}} />,
    );
    expect(container.querySelector(".ui-textarea-clear")).not.toBeInTheDocument();
  });

  it("clearable click fires onChange with empty value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <Textarea value="abc" clearable onChange={onChange} />,
    );
    await user.click(container.querySelector(".ui-textarea-clear")!);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].target.value).toBe("");
  });
});
