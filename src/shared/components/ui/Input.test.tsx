import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

  it("applies ui-input-sm when size='sm'", () => {
    render(<Input placeholder="x" size="sm" />);
    expect(screen.getByPlaceholderText("x").className).toMatch(/ui-input-sm/);
  });

  it("applies ui-input-lg when size='lg'", () => {
    render(<Input placeholder="x" size="lg" />);
    expect(screen.getByPlaceholderText("x").className).toMatch(/ui-input-lg/);
  });

  it("omits size class when size='md' (default)", () => {
    render(<Input placeholder="x" />);
    expect(screen.getByPlaceholderText("x").className).not.toMatch(/ui-input-(sm|lg)/);
  });

  it("state='loading' disables the input and exposes aria-busy", () => {
    render(<Input placeholder="x" state="loading" />);
    const el = screen.getByPlaceholderText("x") as HTMLInputElement;
    expect(el.disabled).toBe(true);
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("state='loading' renders a spinner inside the shell", () => {
    const { container } = render(<Input placeholder="x" state="loading" />);
    expect(container.querySelector(".ui-input-shell")).toBeInTheDocument();
    expect(container.querySelector("svg.ui-spinner")).toBeInTheDocument();
  });

  it("state='success' renders a check icon inside the shell", () => {
    const { container } = render(<Input placeholder="x" state="success" />);
    expect(container.querySelector(".ui-input-shell")).toBeInTheDocument();
    expect(container.querySelector(".ui-input-icon-ok")).toBeInTheDocument();
  });

  it("state='invalid' applies ui-input-invalid and aria-invalid", () => {
    render(<Input placeholder="x" state="invalid" />);
    const el = screen.getByPlaceholderText("x").closest(".ui-input-shell, input");
    expect(el?.className).toMatch(/ui-input-invalid/);
    expect(screen.getByPlaceholderText("x")).toHaveAttribute("aria-invalid", "true");
  });

  it("no state: no shell wrapper, no trailing icon", () => {
    const { container } = render(<Input placeholder="x" />);
    expect(container.querySelector(".ui-input-shell")).not.toBeInTheDocument();
    expect(container.querySelector(".ui-input-icon")).not.toBeInTheDocument();
  });

  it("renders a prepend in the shell", () => {
    const { container } = render(
      <Input placeholder="x" prepend={<span data-testid="prefix">P</span>} />,
    );
    expect(container.querySelector(".ui-input-shell")).toBeInTheDocument();
    expect(container.querySelector(".ui-input-affix-prepend")).toBeInTheDocument();
    expect(screen.getByTestId("prefix")).toBeInTheDocument();
  });

  it("renders an append in the shell", () => {
    const { container } = render(
      <Input placeholder="x" append={<span data-testid="suffix">S</span>} />,
    );
    expect(container.querySelector(".ui-input-affix-append")).toBeInTheDocument();
    expect(screen.getByTestId("suffix")).toBeInTheDocument();
  });

  it("clearable shows the clear button when value is non-empty", () => {
    const { container } = render(
      <Input placeholder="x" value="abc" clearable onChange={() => {}} />,
    );
    expect(container.querySelector(".ui-input-clear")).toBeInTheDocument();
  });

  it("clearable hides the clear button when value is empty", () => {
    const { container } = render(
      <Input placeholder="x" value="" clearable onChange={() => {}} />,
    );
    expect(container.querySelector(".ui-input-clear")).not.toBeInTheDocument();
  });

  it("clearable hides the clear button when disabled", () => {
    const { container } = render(
      <Input placeholder="x" value="abc" clearable disabled onChange={() => {}} />,
    );
    expect(container.querySelector(".ui-input-clear")).not.toBeInTheDocument();
  });

  it("clearable hides the clear button when state='loading'", () => {
    const { container } = render(
      <Input
        placeholder="x"
        value="abc"
        clearable
        state="loading"
        onChange={() => {}}
      />,
    );
    expect(container.querySelector(".ui-input-clear")).not.toBeInTheDocument();
  });

  it("clearable click fires onChange with empty value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <Input placeholder="x" value="abc" clearable onChange={onChange} />,
    );
    await user.click(container.querySelector(".ui-input-clear")!);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].target.value).toBe("");
  });

  it("prepend + state icon + clear all coexist", () => {
    const { container } = render(
      <Input
        placeholder="x"
        prepend={<span data-testid="prefix">P</span>}
        state="invalid"
        value="abc"
        clearable
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId("prefix")).toBeInTheDocument();
    expect(container.querySelector(".ui-input-icon-err")).toBeInTheDocument();
    expect(container.querySelector(".ui-input-clear")).toBeInTheDocument();
  });
});
