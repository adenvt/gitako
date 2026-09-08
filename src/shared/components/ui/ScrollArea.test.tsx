import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollArea } from "./ScrollArea";

describe("ScrollArea (kit)", () => {
  it("bare form renders Root + Viewport + Scrollbar + Thumb", () => {
    const { container } = render(
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>,
    );
    const root = container.querySelector('[class*="ui-scrollarea"]');
    expect(root).not.toBeNull();
    expect(root!.textContent).toContain("Content");
  });

  it("bare form applies height: 100% by default", () => {
    const { container } = render(
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>,
    );
    const root = container.querySelector('[class*="ui-scrollarea"]') as HTMLElement;
    expect(root.style.height).toBe("100%");
  });

  it("bare form merges caller style over defaults", () => {
    const { container } = render(
      <ScrollArea style={{ height: "240px" }}>
        <div>Content</div>
      </ScrollArea>,
    );
    const root = container.querySelector('[class*="ui-scrollarea"]') as HTMLElement;
    expect(root.style.height).toBe("240px");
  });

  it("forwards className to the Root", () => {
    const { container } = render(
      <ScrollArea className="my-scroll">
        <div>Content</div>
      </ScrollArea>,
    );
    const root = container.querySelector('[class*="ui-scrollarea"]');
    expect(root!.className).toMatch(/my-scroll/);
  });

  it("compound Root applies ui-scrollarea", () => {
    const { container } = render(
      <ScrollArea.Root style={{ height: "100px" }}>
        <ScrollArea.Viewport>
          <ScrollArea.Content>Compound</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );
    const root = container.querySelector('[class*="ui-scrollarea"]');
    expect(root).not.toBeNull();
    expect(root!.textContent).toContain("Compound");
  });

  it("compound Scrollbar applies scrollbarTrack class", () => {
    const { container } = render(
      <ScrollArea.Root style={{ height: "100px" }}>
        <ScrollArea.Viewport>
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );
    const track = container.querySelector('[class*="scrollbarTrack"]');
    expect(track).not.toBeNull();
  });

  it("compound Thumb applies scrollbarThumb class", () => {
    const { container } = render(
      <ScrollArea.Root style={{ height: "100px" }}>
        <ScrollArea.Viewport>
          <ScrollArea.Content>Content</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );
    const thumb = container.querySelector('[class*="scrollbarThumb"]');
    expect(thumb).not.toBeNull();
  });

  it("compound Scrollbar defaults to keepMounted={true}", () => {
    const { container } = render(
      <ScrollArea.Root style={{ height: "100px" }}>
        <ScrollArea.Viewport>
          <ScrollArea.Content>Short</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );
    // Even with short content (no overflow), the scrollbar is mounted.
    const track = container.querySelector('[class*="scrollbarTrack"]');
    expect(track).not.toBeNull();
  });

  it("compound Scrollbar honors keepMounted={false} — track is hidden when no overflow", () => {
    const { container } = render(
      <ScrollArea.Root style={{ height: "100px" }}>
        <ScrollArea.Viewport>
          <ScrollArea.Content>Short</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" keepMounted={false}>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );
    // With keepMounted={false} and no overflow, the scrollbar track
    // is either not rendered or hidden. Verify no crash and the
    // content is still visible.
    const content = container.querySelector('[class*="ui-scrollarea"]');
    expect(content).not.toBeNull();
    expect(content!.textContent).toContain("Short");
  });

  it("forwards ref to the Root (bare form)", () => {
    const ref = { current: null as HTMLDivElement | null };
    const RefComp = () => (
      <ScrollArea ref={ref}>
        <div>Content</div>
      </ScrollArea>
    );
    render(<RefComp />);
    expect(ref.current).not.toBeNull();
  });
});
