import { forwardRef, type ComponentProps, type CSSProperties } from "react";
import clsx from "clsx";
import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";

export type ScrollAreaRootProps = ComponentProps<typeof BaseScrollArea.Root>;

/**
 * Base UI ScrollArea with the app's shared scrollbar chrome.
 * Wraps @base-ui/react/scroll-area — use this instead of importing
 * `@base-ui/react/scroll-area` directly so every scrollable region in
 * the app reads as one consistent scrollbar.
 *
 * Two ways to use it:
 *   - **Bare form** (default for new code): `<ScrollArea>{children}</ScrollArea>`
 *     renders Root + Viewport + Scrollbar + Thumb in one call.
 *   - **Compound form** (for advanced cases): `<ScrollArea.Root>`,
 *     `<ScrollArea.Viewport>`, `<ScrollArea.Scrollbar>`, `<ScrollArea.Thumb>`.
 *     Use this when you need a custom child inside `Scrollbar` (e.g.
 *     `DiffMinimap`) or need to measure the `Viewport` directly
 *     (e.g. `CommitList`, `DiffPane`).
 *
 * Notes on the shared chrome:
 *   - `Root` is a flex column so the inner `Viewport` (also a flex child
 *     with `flex: 1; min-height: 0`) fills the root and the Viewport's
 *     `overflow: scroll` actually scrolls. This is required for popups
 *     and any container that constrains the root's height.
 *   - `Viewport` is wrapped with `forwardRef` so caller refs reach the
 *     inner Base UI div.
 *   - `Scrollbar` defaults to `class="scrollbarTrack"` and
 *     `keepMounted={true}`. Caller classNames and `keepMounted=false`
 *     still win via spread.
 *   - `Thumb` defaults to `class="scrollbarThumb"`. Children inside
 *     `Scrollbar` (e.g. the diff minimap) pass through verbatim.
 */
const Root = forwardRef<HTMLDivElement, ComponentProps<typeof BaseScrollArea.Root>>(
  function ScrollAreaRoot({ className, ...props }, ref) {
    const final = clsx("ui-scrollarea", className);
    return <BaseScrollArea.Root ref={ref} className={final} {...props} />;
  },
);

const Viewport = forwardRef<HTMLDivElement, ComponentProps<typeof BaseScrollArea.Viewport>>(
  function ScrollAreaViewport({ className, ...props }, ref) {
    return <BaseScrollArea.Viewport ref={ref} className={className} {...props} />;
  },
);

const Content = forwardRef<HTMLDivElement, ComponentProps<typeof BaseScrollArea.Content>>(
  function ScrollAreaContent({ className, ...props }, ref) {
    return <BaseScrollArea.Content ref={ref} className={className} {...props} />;
  },
);

const Scrollbar = forwardRef<HTMLDivElement, ComponentProps<typeof BaseScrollArea.Scrollbar>>(
  function ScrollAreaScrollbar({ className, keepMounted = true, children, ...props }, ref) {
    return (
      <BaseScrollArea.Scrollbar
        ref={ref}
        className={clsx("scrollbarTrack", className)}
        keepMounted={keepMounted}
        {...props}
      >
        {children}
      </BaseScrollArea.Scrollbar>
    );
  },
);

const Thumb = forwardRef<HTMLDivElement, ComponentProps<typeof BaseScrollArea.Thumb>>(
  function ScrollAreaThumb({ className, ...props }, ref) {
    return (
      <BaseScrollArea.Thumb ref={ref} className={clsx("scrollbarThumb", className)} {...props} />
    );
  },
);

const ScrollAreaWrapper = forwardRef<HTMLDivElement, ScrollAreaRootProps>(
  function ScrollAreaWrapper({ className, style, children, ...props }, ref) {
    // Default to `height: 100%` so the bare form fills its parent and the
    // inner Viewport's `flex: 1 1 auto; min-height: 0` can engage. Callers
    // can override via `style={{ height: "240px" }}` or by giving the
    // parent a constrained size. Without a height on the Root, the flex
    // column expands to fit the content and the scrollbar never appears.
    const mergedStyle: CSSProperties = { height: "100%", ...style };
    return (
      <Root ref={ref} className={className} style={mergedStyle} {...props}>
        <Viewport>
          <Content>{children}</Content>
        </Viewport>
        <Scrollbar>
          <Thumb />
        </Scrollbar>
      </Root>
    );
  },
);

type ScrollAreaCompound = {
  Root: typeof Root;
  Viewport: typeof Viewport;
  Content: typeof Content;
  Scrollbar: typeof Scrollbar;
  Thumb: typeof Thumb;
  Corner: typeof BaseScrollArea.Corner;
};

const ScrollAreaObject: ScrollAreaCompound = {
  Root,
  Viewport,
  Content,
  Scrollbar,
  Thumb,
  Corner: BaseScrollArea.Corner,
};

export const ScrollArea = ScrollAreaWrapper as typeof ScrollAreaWrapper & ScrollAreaCompound;
// Attach compound members. `Object.assign` preserves both the callable signature
// and the static parts, so `<ScrollArea>` and `<ScrollArea.Root>` both work.
Object.assign(ScrollArea, ScrollAreaObject);
