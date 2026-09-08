import { render, fireEvent, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select } from "./Select";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

describe("Select (kit) - bare form", () => {
  it("renders a Trigger inside a Select.Root with the ui-trigger-select class", () => {
    const { container } = render(
      <Select.Root>
        <Select.Trigger>Choose…</Select.Trigger>
      </Select.Root>,
    );
    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();
    expect(trigger!.textContent).toContain("Choose…");
    expect(trigger!.className).toMatch(/ui-trigger-select/);
  });

  it("re-exports every Base UI part the app uses (spread keeps the API surface)", () => {
    expect(Select.Root).toBeDefined();
    expect(Select.Trigger).toBeDefined();
    expect(Select.Portal).toBeDefined();
    expect(Select.Positioner).toBeDefined();
    expect(Select.Popup).toBeDefined();
    expect(Select.Item).toBeDefined();
  });

  it("bare form renders Trigger + Value + Icon", () => {
    const { container } = render(
      <Select options={OPTIONS} placeholder="Pick one" />,
    );
    const trigger = container.querySelector('[class*="ui-trigger-select"]');
    expect(trigger).not.toBeNull();
    expect(trigger!.textContent).toContain("Pick one");
    expect(trigger!.textContent).toContain("▾");
  });

  it("bare form renders options as Items with ItemIndicator + ItemText", () => {
    const { container } = render(
      <Select options={OPTIONS} placeholder="Pick one" />,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const items = document.body.querySelectorAll('[class*="ui-item"]');
    expect(items.length).toBe(3);
    expect(document.body.textContent).toContain("Alpha");
    expect(document.body.textContent).toContain("Bravo");
    expect(document.body.textContent).toContain("Charlie");
  });

  it("bare form renders children override slot instead of options.map", () => {
    const { container } = render(
      <Select options={OPTIONS} placeholder="Pick one">
        <Select.Item value="custom">
          <Select.ItemText>Custom</Select.ItemText>
        </Select.Item>
      </Select>,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const items = document.body.querySelectorAll('[class*="ui-item"]');
    expect(items.length).toBe(1);
    expect(document.body.textContent).toContain("Custom");
    expect(document.body.textContent).not.toContain("Alpha");
  });

  it("displays the selected value's label in the trigger", () => {
    const { container } = render(
      <Select
        options={OPTIONS}
        value="b"
        onValueChange={() => {}}
        placeholder="Pick one"
      />,
    );
    const trigger = container.querySelector('[class*="ui-trigger-select"]');
    expect(trigger!.textContent).toContain("Bravo");
  });

  it("ItemIndicator renders a CheckIcon when selected", () => {
    const { container } = render(
      <Select
        options={OPTIONS}
        value="a"
        onValueChange={() => {}}
        placeholder="Pick one"
      />,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const checkIcon = document.body.querySelector("svg");
    expect(checkIcon).not.toBeNull();
  });

  it("forwards aria-labelledby to the trigger", () => {
    const { container } = render(
      <Select options={OPTIONS} placeholder="Pick one" aria-labelledby="my-label" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.getAttribute("aria-labelledby")).toBe("my-label");
  });

  it("forwards className to the trigger", () => {
    const { container } = render(
      <Select options={OPTIONS} placeholder="Pick one" className="my-custom" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).toMatch(/my-custom/);
  });

  it("disabled prop disables the trigger", () => {
    const { container } = render(
      <Select options={OPTIONS} placeholder="Pick one" disabled />,
    );
    const trigger = container.querySelector("button") as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });

  it("renders Empty fallback when options is empty array", () => {
    const { container } = render(
      <Select options={[]} placeholder="No options" />,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const empty = document.body.querySelector('[class*="ui-empty"]');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain("No options");
  });
});

describe("Select (kit) - size prop", () => {
  it("size=\"sm\" applies ui-select-sm to the trigger", () => {
    const { container } = render(
      <Select size="sm" options={OPTIONS} placeholder="Small" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).toMatch(/ui-select-sm/);
  });

  it("size=\"lg\" applies ui-select-lg to the trigger", () => {
    const { container } = render(
      <Select size="lg" options={OPTIONS} placeholder="Large" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).toMatch(/ui-select-lg/);
  });

  it("default size (md) does not apply size class", () => {
    const { container } = render(
      <Select options={OPTIONS} placeholder="Default" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).not.toMatch(/ui-select-(sm|lg)/);
  });
});

describe("Select (kit) - state prop", () => {
  it("state=\"invalid\" applies ui-select-invalid to the trigger", () => {
    const { container } = render(
      <Select state="invalid" options={OPTIONS} placeholder="Invalid" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).toMatch(/ui-select-invalid/);
  });

  it("state=\"success\" applies ui-select-success to the trigger", () => {
    const { container } = render(
      <Select state="success" options={OPTIONS} placeholder="Success" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).toMatch(/ui-select-success/);
  });

  it("no state does not apply state class", () => {
    const { container } = render(
      <Select options={OPTIONS} placeholder="Default" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).not.toMatch(/ui-select-(invalid|success)/);
  });
});

describe("Select (kit) - compound overrides", () => {
  it("Trigger override applies ui-trigger-select", () => {
    const { container } = render(
      <Select.Root>
        <Select.Trigger>Open</Select.Trigger>
      </Select.Root>,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).toMatch(/ui-trigger-select/);
  });

  it("Positioner override applies ui-positioner when open", () => {
    const { container } = render(
      <Select.Root>
        <Select.Trigger>Open</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="x">
                <Select.ItemText>Item</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const positioner = document.body.querySelector('[class*="ui-positioner"]');
    expect(positioner).not.toBeNull();
  });

  it("Popup override applies ui-popup when open", () => {
    const { container } = render(
      <Select.Root>
        <Select.Trigger>Open</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="x">
                <Select.ItemText>Item</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const popup = document.body.querySelector('[class*="ui-popup"]');
    expect(popup).not.toBeNull();
  });

  it("Item override applies ui-item when open", () => {
    const { container } = render(
      <Select.Root>
        <Select.Trigger>Open</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="x">
                <Select.ItemText>Item</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const item = document.body.querySelector('[class*="ui-item"]');
    expect(item).not.toBeNull();
  });
});
