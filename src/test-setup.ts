// Vitest setup: wire up @testing-library/jest-dom matchers (toBeInTheDocument,
// toHaveTextContent, etc.) and force cleanup between tests.
//
// Imported once via the `setupFiles` option in vite.config.ts.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// happy-dom doesn't implement Element.getAnimations() yet, but Base UI's
// ScrollArea viewport calls it in a setTimeout to detect scroll-end. Stub
// it to an empty array so the timeout no-ops instead of throwing.
if (typeof Element !== "undefined" && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = function () {
    return [];
  };
}

afterEach(() => {
  cleanup();
});
