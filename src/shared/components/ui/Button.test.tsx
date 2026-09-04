import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button (kit)", () => {
  it("renders solid by default with the ui-btn class", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).className).toMatch(/ui-btn/);
  });

  it("maps primary to ui-btn + ui-btn-primary", () => {
    render(<Button variant="primary">Commit</Button>);
    expect(screen.getByRole("button", { name: "Commit" }).className).toMatch(/ui-btn-primary/);
  });

  it("maps ghost to ui-ghost", () => {
    render(<Button variant="ghost">Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" }).className).toMatch(/ui-ghost/);
  });

  it("renders variant=none without kit classes", () => {
    render(
      <Button variant="none" className="my-bespoke">
        Bespoke
      </Button>,
    );
    const el = screen.getByRole("button", { name: "Bespoke" });
    expect(el.className).toMatch(/my-bespoke/);
    expect(el.className).not.toMatch(/ui-btn|ui-ghost/);
  });

  it('defaults type to "button" so it never submits forms', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button");
  });

  it("respects an explicit type override", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("type")).toBe("submit");
  });

  it('defaults to md (no size class)', () => {
    render(<Button>Save</Button>);
    const cls = screen.getByRole("button", { name: "Save" }).className;
    expect(cls).not.toMatch(/ui-btn-sm|ui-btn-lg|ui-btn-icon/);
  });

  it("maps subtle to ui-btn-subtle", () => {
    render(<Button variant="subtle">Stage all</Button>);
    expect(screen.getByRole("button", { name: "Stage all" }).className).toMatch(/ui-btn-subtle/);
  });

  it("loading disables the button and exposes aria-busy", () => {
    render(<Button loading>Push</Button>);
    const el = screen.getByRole("button", { name: "Push" }) as HTMLButtonElement;
    expect(el.disabled).toBe(true);
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("maps danger to ui-btn + ui-btn-danger", () => {
    render(<Button variant="danger">Delete branch</Button>);
    const cls = screen.getByRole("button", { name: "Delete branch" }).className;
    expect(cls).toMatch(/ui-btn /);
    expect(cls).toMatch(/ui-btn-danger/);
  });

  it("maps size=\"sm\", size=\"lg\" and size=\"icon\"", () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="lg">Get started</Button>
        <Button size="icon" aria-label="Close">
          ×
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Small" }).className).toMatch(/ui-btn-sm/);
    expect(screen.getByRole("button", { name: "Get started" }).className).toMatch(/ui-btn-lg/);
    expect(screen.getByRole("button", { name: "Close" }).className).toMatch(/ui-btn-icon/);
  });
});
