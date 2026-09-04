import { fileURLToPath, URL } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import autoprefixer from "autoprefixer";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
  ],
  staticDirs: ["../assets"],
  // Storybook 10's framework preset (@storybook/react-vite) already wires up
  // @vitejs/plugin-react for Fast Refresh. vite-plus 0.3.0 ALSO injects its own
  // built-in React Refresh wrapper ("builtin:vite-react-refresh-wrapper") into
  // the Vite plugin list. Both register the `RefreshRuntime` global, which
  // makes the browser throw "Identifier 'RefreshRuntime' has already been
  // declared" when the preview loads. We filter out vite-plus's built-in here
  // and let @storybook/react-vite own React Refresh.
  viteFinal: async (viteConfig) => {
    const plugins = (viteConfig.plugins ?? []).filter((p) => {
      const name = (p as { name?: string }).name;
      return name !== "builtin:vite-react-refresh-wrapper";
    });
    const existingAlias = (viteConfig.resolve?.alias ?? {}) as Record<string, string>;
    return {
      ...viteConfig,
      plugins,
      resolve: {
        ...viteConfig.resolve,
        alias: {
          ...existingAlias,
          "@": fileURLToPath(new URL("../src", import.meta.url)),
          "@assets": fileURLToPath(new URL("../assets", import.meta.url)),
        },
      },
      css: {
        ...viteConfig.css,
        postcss: { plugins: [autoprefixer()] },
      },
    };
  },
};

export default config;
