import { useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "./ScrollArea";

const meta: Meta<typeof ScrollArea> = {
  title: "UI Kit/ScrollArea",
  component: ScrollArea,
  parameters: {
    docs: {
      description: {
        component:
          "App's shared scrollbar chrome. Two ways to use: `<ScrollArea>{content}</ScrollArea>` for the bare form (Root + Viewport + Content + vertical Scrollbar), or the compound form (`<ScrollArea.Root>` / `.Viewport` / `.Content` / `.Scrollbar` / `.Thumb`) for advanced cases — custom scrollbar children, viewport measurement, both axes.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 360,
          height: 240,
          padding: 16,
          background: "var(--bg-raised)",
          boxSizing: "border-box",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ScrollArea>;

/* ---------- bare form: <ScrollArea>{content}</ScrollArea> ---------- */

export const LongText: Story = {
  name: "Long text (bare form)",
  parameters: {
    docs: {
      description: {
        story:
          "The bare form wraps Root + Viewport + Content + a vertical Scrollbar. Best for plain text, code blocks, or any case where the caller doesn't need to reach into the compound parts.",
      },
    },
  },
  render: () => (
    <ScrollArea>
      <pre style={{ margin: 0, padding: 12, fontFamily: "var(--font-mono)", fontSize: 13 }}>
        {Array.from(
          { length: 80 },
          (_, i) => `Line ${String(i + 1).padStart(2, "0")}: lorem ipsum dolor sit amet`,
        ).join("\n")}
      </pre>
    </ScrollArea>
  ),
};

export const TallList: Story = {
  name: "Tall list (bare form)",
  parameters: {
    docs: {
      description: {
        story:
          "The common case: a list of selectable rows. Hover any row to see the highlight via inline `onMouseEnter`/`onMouseLeave` toggling `--bg-hover` — no extra CSS module needed.",
      },
    },
  },
  render: () => (
    <ScrollArea>
      <ul style={{ margin: 0, padding: "4px 0", listStyle: "none" }}>
        {Array.from({ length: 60 }, (_, i) => (
          <li
            key={i}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 13,
              color: "var(--text)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span className="muted" style={{ marginRight: 8 }}>
              {String(i + 1).padStart(3, "0")}
            </span>
            item-{i + 1}
          </li>
        ))}
      </ul>
    </ScrollArea>
  ),
};

export const StickyHeader: Story = {
  name: "Sticky header (bare form)",
  parameters: {
    docs: {
      description: {
        story:
          "A common pattern: a fixed-height section with a sticky title that stays visible while the list scrolls underneath. Uses `position: sticky; top: 0` on the header element — no special API needed.",
      },
    },
  },
  render: () => (
    <ScrollArea>
      <div
        style={{
          position: "sticky",
          top: 0,
          padding: "8px 12px",
          background: "var(--bg-raised)",
          borderBottom: "1px solid var(--border)",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-dim)",
        }}
      >
        Recent commits
      </div>
      <ul style={{ margin: 0, padding: "4px 0", listStyle: "none" }}>
        {Array.from({ length: 40 }, (_, i) => (
          <li
            key={i}
            style={{
              padding: "4px 12px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text)",
            }}
          >
            <span style={{ color: "var(--text-dim)" }}>abc{i.toString(16).padStart(4, "0")} </span>
            commit message {i + 1}
          </li>
        ))}
      </ul>
    </ScrollArea>
  ),
};

export const ShortContent: Story = {
  name: "Short content (no scrollbar)",
  parameters: {
    docs: {
      description: {
        story:
          "When the content fits the viewport, the scrollbar is automatically hidden — `.scrollbarTrack:not([data-has-overflow-y]) { visibility: hidden }` removes the empty gutter. Useful for proving the empty-scrollbar state isn't a rendering bug.",
      },
    },
  },
  render: () => (
    <ScrollArea>
      <p style={{ margin: 0, padding: 12 }}>This content fits. No scrollbar visible.</p>
    </ScrollArea>
  ),
};

/* ---------- compound form: <ScrollArea.Root>...<ScrollArea.Thumb> ---------- */

export const CompoundForm: Story = {
  name: "Compound form (Root + Viewport + Content + Scrollbar)",
  parameters: {
    docs: {
      description: {
        story:
          "Use the compound form when you need to apply a className to the Root or Viewport, or attach a ref. The shape mirrors Base UI's `<ScrollArea.Root>` etc. — className-injecting wrappers apply the kit chrome. The bare wrapper sets `height: 100%` on Root by default, so this form needs an explicit height to fill the parent (e.g. via a CSS class or `style={{ height: '100%' }}`).",
      },
    },
  },
  render: () => (
    <ScrollArea.Root style={{ height: "100%" }}>
      <ScrollArea.Viewport>
        <ScrollArea.Content>
          <p style={{ margin: 0, padding: 12 }}>
            Custom markup between the parts. The kit adds the `ui-scrollarea` class to Root and
            `scrollbarTrack` / `scrollbarThumb` to the Scrollbar / Thumb automatically.
          </p>
          <p style={{ margin: 0, padding: 12, color: "var(--text-dim)" }}>
            Scroll the container to see the custom scrollbar chrome in action.
          </p>
          {Array.from({ length: 30 }, (_, i) => (
            <p key={i} style={{ margin: 0, padding: "6px 12px" }}>
              Paragraph {i + 1}
            </p>
          ))}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical">
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  ),
};

export const BothAxes: Story = {
  name: "Both axes (wide + tall content)",
  parameters: {
    docs: {
      description: {
        story:
          "Content that overflows both horizontally and vertically. Renders both scrollbars. Note the bottom-right corner square (filled with `--bg-inset` so the horizontal bar visibly ends at the vertical one).",
      },
    },
  },
  render: () => (
    <ScrollArea.Root style={{ width: 320, height: 200 }}>
      <ScrollArea.Viewport>
        <ScrollArea.Content>
          <div style={{ width: 1200, padding: 12 }}>
            <p style={{ marginTop: 0 }}>
              This block is intentionally 1200px wide so the horizontal scrollbar appears. Use both
              arrow keys / trackpad to scroll in any direction. The corner between the two
              scrollbars is filled with `--bg-inset` so they meet cleanly.
            </p>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
              exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
          </div>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="horizontal">
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar orientation="vertical">
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  ),
};

export const WithViewportRef: Story = {
  name: "Compound form + viewport ref (advanced)",
  parameters: {
    docs: {
      description: {
        story:
          "The compound Viewport forwards its ref to the inner Base UI div, so callers can measure it (CommitList, DiffPane) or call `scrollTo(...)` directly. Click the button to scroll the content programmatically.",
      },
    },
  },
  render: function WithViewportRefRender() {
    const viewportRef = useRef<HTMLDivElement>(null);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <button
          className="ui-btn"
          onClick={() => viewportRef.current?.scrollTo({ top: 600, behavior: "smooth" })}
        >
          scrollTo(600)
        </button>
        <ScrollArea.Root style={{ flex: 1, minHeight: 0 }}>
          <ScrollArea.Viewport ref={viewportRef}>
            <ScrollArea.Content>
              {Array.from({ length: 50 }, (_, i) => (
                <p key={i} style={{ margin: 0, padding: "4px 12px" }}>
                  Row {i + 1}
                </p>
              ))}
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </div>
    );
  },
};
