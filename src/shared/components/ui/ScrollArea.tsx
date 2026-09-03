import { forwardRef, type ComponentProps } from "react";
import clsx from "clsx";
import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";

export type ScrollAreaRootProps = ComponentProps<typeof BaseScrollArea.Root>;

/**
 * Base UI ScrollArea with the app's shared scrollbar chrome.
 * Wraps @base-ui/react/scroll-area — use this instead of importing
 * `@base-ui/react/scroll-area` directly so every scrollable region in
 * the app reads as one consistent scrollbar.
 *
 * - `Root` is a flex column so the inner `Viewport` (also a flex child
 *   with `flex: 1; min-height: 0`) fills the root and the Viewport's
 *   `overflow: scroll` actually scrolls. This is required for popups
 *   and any container that constrains the root's height; the working
 *   FileTree/OpenRepo/CommitList call sites already set this on the
 *   Root, but the kit makes it the default so nested-in-popup usage
 *   works without per-call CSS.
 * - `Viewport` is wrapped with `forwardRef` so caller refs reach the
 *   inner Base UI div (CommitList / DiffPane measure the viewport
 *   directly).
 * - `Scrollbar` defaults to `class="scrollbarTrack"` and
 *   `keepMounted={true}`. Caller classNames and `keepMounted=false` still
 *   win via spread.
 * - `Thumb` defaults to `class="scrollbarThumb"`. Children inside
 *   `Scrollbar` (e.g. the diff minimap) pass through verbatim.
 */
const Root = forwardRef<HTMLDivElement, ComponentProps<typeof BaseScrollArea.Root>>(
  function ScrollAreaRoot({ className, ...props }, ref) {
    const final = clsx("ui-scrollarea", className);
    return (
      <BaseScrollArea.Root
        ref={ref}
        className={final}
        {...props}
      />
    );
  },
);

const Viewport = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof BaseScrollArea.Viewport>
>(function ScrollAreaViewport({ className, ...props }, ref) {
  return <BaseScrollArea.Viewport ref={ref} className={className} {...props} />;
});

const Scrollbar = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof BaseScrollArea.Scrollbar>
>(function ScrollAreaScrollbar(
  { className, keepMounted = true, children, ...props },
  ref,
) {
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
});

const Thumb = forwardRef<HTMLDivElement, ComponentProps<typeof BaseScrollArea.Thumb>>(
  function ScrollAreaThumb({ className, ...props }, ref) {
    return (
      <BaseScrollArea.Thumb
        ref={ref}
        className={clsx("scrollbarThumb", className)}
        {...props}
      />
    );
  },
);

export const ScrollArea = {
  ...BaseScrollArea,
  Root,
  Viewport,
  Scrollbar,
  Thumb,
};
