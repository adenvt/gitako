import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Combobox } from "./Combobox";

describe("Combobox (kit) - bare form", () => {
  it("applies ui-input + ui-input-flat to the Input inside the InputGroup shell", () => {
    const { container } = render(
      <Combobox
        variant="input"
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
        placeholder="Pick one"
      />,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    // The bare Combobox.Input wrapper applies "ui-input ui-input-flat" so
    // the inner input has no border (it lives inside the bordered
    // .ui-input-group shell — the border should only show on the shell).
    expect(input!.className).toMatch(/ui-input/);
    expect(input!.className).toMatch(/ui-input-flat/);
  });

  it("wraps the Input in a bordered ui-input-group shell", () => {
    const { container } = render(
      <Combobox variant="input" options={[{ value: "a", label: "A" }]} placeholder="Pick one" />,
    );
    const group = container.querySelector('[class*="ui-input-group"]');
    expect(group).not.toBeNull();
    expect(group!.className).toMatch(/ui-input-group/);
  });
});
