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
