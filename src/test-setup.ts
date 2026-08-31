// Vitest setup: wire up @testing-library/jest-dom matchers (toBeInTheDocument,
// toHaveTextContent, etc.) and force cleanup between tests.
//
// Imported once via the `setupFiles` option in vite.config.ts.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
