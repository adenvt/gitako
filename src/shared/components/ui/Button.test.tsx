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
});
