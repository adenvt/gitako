import { render, fireEvent, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Combobox } from "./Combobox";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

describe("Combobox (kit) - bare form", () => {
  it("applies ui-input + ui-input-flat to the Input inside the InputGroup shell", () => {
    const { container } = render(
      <Combobox variant="input" options={OPTIONS} placeholder="Pick one" />,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    expect(input!.className).toMatch(/ui-input/);
    expect(input!.className).toMatch(/ui-input-flat/);
  });

  it("wraps the Input in a bordered ui-input-group shell", () => {
    const { container } = render(
      <Combobox variant="input" options={OPTIONS} placeholder="Pick one" />,
    );
    const group = container.querySelector('[class*="ui-input-group"]');
    expect(group).not.toBeNull();
    expect(group!.className).toMatch(/ui-input-group/);
  });

  it("variant=\"trigger\" renders Trigger + Value + Icon", () => {
    const { container } = render(
      <Combobox variant="trigger" options={OPTIONS} placeholder="Pick one" />,
    );
    const trigger = container.querySelector('[class*="ui-trigger-combobox"]');
    expect(trigger).not.toBeNull();
    expect(trigger!.textContent).toContain("Pick one");
    expect(trigger!.textContent).toContain("▾");
  });

  it("variant=\"input\" renders InputGroup + Input + Trigger", () => {
    const { container } = render(
      <Combobox variant="input" options={OPTIONS} placeholder="Pick one" />,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();
    expect(trigger!.textContent).toContain("▾");
  });

  it("displays the selected value's label in the input", () => {
    const { container } = render(
      <Combobox
        variant="input"
        options={OPTIONS}
        value="b"
        onValueChange={() => {}}
        placeholder="Pick one"
      />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("Bravo");
  });

  it("variant=\"trigger\" displays the selected value's label", () => {
    const { container } = render(
      <Combobox
        variant="trigger"
        options={OPTIONS}
        value="c"
        onValueChange={() => {}}
        placeholder="Pick one"
      />,
    );
    const trigger = container.querySelector('[class*="ui-trigger-combobox"]');
    expect(trigger!.textContent).toContain("Charlie");
  });

  it("forwards aria-labelledby to the input (variant=input)", () => {
    const { container } = render(
      <Combobox variant="input" options={OPTIONS} placeholder="Pick one" aria-labelledby="my-label" />,
    );
    const input = container.querySelector("input");
    expect(input!.getAttribute("aria-labelledby")).toBe("my-label");
  });

  it("forwards aria-labelledby to the trigger (variant=trigger)", () => {
    const { container } = render(
      <Combobox variant="trigger" options={OPTIONS} placeholder="Pick one" aria-labelledby="my-label" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.getAttribute("aria-labelledby")).toBe("my-label");
  });

  it("forwards className to the input-group shell (variant=input)", () => {
    const { container } = render(
      <Combobox variant="input" options={OPTIONS} placeholder="Pick one" className="my-custom" />,
    );
    const group = container.querySelector('[class*="ui-input-group"]');
    expect(group!.className).toMatch(/my-custom/);
  });

  it("forwards className to the trigger (variant=trigger)", () => {
    const { container } = render(
      <Combobox variant="trigger" options={OPTIONS} placeholder="Pick one" className="my-custom" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).toMatch(/my-custom/);
  });

  it("variant=\"trigger\" renders a filter input in the popup", () => {
    const { container } = render(
      <Combobox variant="trigger" options={OPTIONS} placeholder="Pick one" />,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const inputs = document.body.querySelectorAll("input");
    // Should have at least 2 inputs: the filter input in popup
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("bare form renders Empty fallback when options is empty array", () => {
    const { container } = render(
      <Combobox options={[]} placeholder="No options" />,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const empty = document.body.querySelector('[class*="ui-empty"]');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain("No matches");
  });

  it("findLabelForValue returns empty string for null value", () => {
    const { container } = render(
      <Combobox variant="input" options={OPTIONS} placeholder="Pick one" />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("findLabelForValue returns empty string when options is undefined", () => {
    const { container } = render(
      <Combobox
        variant="input"
        value="a"
        onValueChange={() => {}}
        placeholder="Pick one"
      />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("findLabelForValue returns empty string for unmatched value", () => {
    const { container } = render(
      <Combobox
        variant="input"
        options={OPTIONS}
        value="nonexistent"
        onValueChange={() => {}}
        placeholder="Pick one"
      />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("");
  });
});

describe("Combobox (kit) - size prop", () => {
  it("size=\"sm\" applies ui-combobox-sm to the input-group shell", () => {
    const { container } = render(
      <Combobox size="sm" options={OPTIONS} placeholder="Small" />,
    );
    const group = container.querySelector('[class*="ui-input-group"]');
    expect(group!.className).toMatch(/ui-combobox-sm/);
  });

  it("size=\"lg\" applies ui-combobox-lg to the input-group shell", () => {
    const { container } = render(
      <Combobox size="lg" options={OPTIONS} placeholder="Large" />,
    );
    const group = container.querySelector('[class*="ui-input-group"]');
    expect(group!.className).toMatch(/ui-combobox-lg/);
  });

  it("default size (md) does not apply size class", () => {
    const { container } = render(
      <Combobox options={OPTIONS} placeholder="Default" />,
    );
    const group = container.querySelector('[class*="ui-input-group"]');
    expect(group!.className).not.toMatch(/ui-combobox-(sm|lg)/);
  });

  it("size=\"sm\" applies ui-combobox-sm to the trigger (variant=trigger)", () => {
    const { container } = render(
      <Combobox size="sm" variant="trigger" options={OPTIONS} placeholder="Small" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).toMatch(/ui-combobox-sm/);
  });
});

describe("Combobox (kit) - state prop", () => {
  it("state=\"invalid\" applies ui-combobox-invalid to the input-group shell", () => {
    const { container } = render(
      <Combobox state="invalid" options={OPTIONS} placeholder="Invalid" />,
    );
    const group = container.querySelector('[class*="ui-input-group"]');
    expect(group!.className).toMatch(/ui-combobox-invalid/);
  });

  it("state=\"success\" applies ui-combobox-success to the input-group shell", () => {
    const { container } = render(
      <Combobox state="success" options={OPTIONS} placeholder="Success" />,
    );
    const group = container.querySelector('[class*="ui-input-group"]');
    expect(group!.className).toMatch(/ui-combobox-success/);
  });

  it("no state does not apply state class", () => {
    const { container } = render(
      <Combobox options={OPTIONS} placeholder="Default" />,
    );
    const group = container.querySelector('[class*="ui-input-group"]');
    expect(group!.className).not.toMatch(/ui-combobox-(invalid|success)/);
  });

  it("state=\"invalid\" applies ui-combobox-invalid to the trigger (variant=trigger)", () => {
    const { container } = render(
      <Combobox state="invalid" variant="trigger" options={OPTIONS} placeholder="Invalid" />,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).toMatch(/ui-combobox-invalid/);
  });
});

describe("Combobox (kit) - compound overrides", () => {
  it("Trigger override applies ui-trigger-combobox", () => {
    const { container } = render(
      <Combobox.Root items={OPTIONS as never}>
        <Combobox.Trigger>Open</Combobox.Trigger>
      </Combobox.Root>,
    );
    const trigger = container.querySelector("button");
    expect(trigger!.className).toMatch(/ui-trigger-combobox/);
  });

  it("InputGroup override applies ui-input-group", () => {
    const { container } = render(
      <Combobox.Root items={OPTIONS as never}>
        <Combobox.InputGroup>
          <Combobox.Input placeholder="Type…" />
          <Combobox.Trigger>▾</Combobox.Trigger>
        </Combobox.InputGroup>
      </Combobox.Root>,
    );
    const group = container.querySelector('[class*="ui-input-group"]');
    expect(group).not.toBeNull();
  });

  it("Input override applies ui-input + ui-input-flat", () => {
    const { container } = render(
      <Combobox.Root items={OPTIONS as never}>
        <Combobox.InputGroup>
          <Combobox.Input placeholder="Type…" />
          <Combobox.Trigger>▾</Combobox.Trigger>
        </Combobox.InputGroup>
      </Combobox.Root>,
    );
    const input = container.querySelector("input");
    expect(input!.className).toMatch(/ui-input/);
    expect(input!.className).toMatch(/ui-input-flat/);
  });

  it("Popup override applies ui-popup when open", () => {
    const { container } = render(
      <Combobox.Root items={OPTIONS as never}>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: { value: string; label: string }) => (
                  <Combobox.Item key={item.value} value={item.value}>
                    {item.label}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
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
      <Combobox.Root items={OPTIONS as never}>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: { value: string; label: string }) => (
                  <Combobox.Item key={item.value} value={item.value}>
                    {item.label}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const item = document.body.querySelector('[class*="ui-item"]');
    expect(item).not.toBeNull();
  });

  it("Empty override applies ui-empty when open", () => {
    const { container } = render(
      <Combobox.Root items={[] as never}>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {() => null}
              </Combobox.List>
              <Combobox.Empty>No matches</Combobox.Empty>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );
    act(() => {
      const trigger = container.querySelector("button")!;
      fireEvent.click(trigger);
    });
    const empty = document.body.querySelector('[class*="ui-empty"]');
    expect(empty).not.toBeNull();
  });
});
