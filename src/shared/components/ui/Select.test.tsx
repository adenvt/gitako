import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select } from "./Select";

describe("Select (kit)", () => {
  // The kit is a thin wrapper over @base-ui/react/select — it spreads
  // BaseSelect onto the local `Select` object and overrides a few part
  // components (Trigger, Portal, Positioner, Popup, Item) to apply the
  // shared `ui-*` chrome. We don't try to render every part in isolation
  // because Base UI's context invariants (PositionerContext, etc.) make
  // a partial render fail loudly. The smoke test below covers the kit's
  // own code paths: the spread, the Trigger override, and the className
  // application.

  it("renders a Trigger inside a Select.Root with the ui-trigger-select class", () => {
    render(
      <Select.Root>
        <Select.Trigger>Choose…</Select.Trigger>
      </Select.Root>,
    );
    const trigger = screen.getByText("Choose…");
    expect(trigger).toBeInTheDocument();
    // The Trigger override applies the shared `ui-trigger-select` class
    // so the global chrome is consistent across the app.
    expect(trigger.className).toMatch(/ui-trigger-select/);
  });

  it("re-exports every Base UI part the app uses (spread keeps the API surface)", () => {
    // The first line of the kit spreads `...BaseSelect`, which preserves
    // the parts we don't override (Root, Value, Icon, etc.). Touching
    // each one ensures the spread is intact and a future refactor doesn't
    // drop a part by accident.
    expect(Select.Root).toBeDefined();
    expect(Select.Trigger).toBeDefined();
    expect(Select.Portal).toBeDefined();
    expect(Select.Positioner).toBeDefined();
    expect(Select.Popup).toBeDefined();
    expect(Select.Item).toBeDefined();
  });
});
