import type { Preview } from "@storybook/react-vite";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import "../src/app/styles/index.css";
import "../src/app/styles/fonts.css";
import "./hc.css";

const preview: Preview = {
  parameters: {
    layout: "padded",
    backgrounds: {
      default: "Raised",
      values: [
        { name: "Base", value: "var(--bg)" },
        { name: "Raised", value: "var(--bg-raised)" },
        { name: "Hover", value: "var(--bg-hover)" },
        { name: "Inset", value: "var(--bg-inset)" },
      ],
    },
  },
  globalTypes: {
    theme: {
      name: "Theme",
      defaultValue: "dark",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "dark", title: "Dark (TUI)" },
          { value: "hc", title: "High contrast" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: {
        dark: "dark",
        hc: "hc",
      },
      defaultTheme: "dark",
      attributeName: "data-theme",
      parentSelector: "html",
    }),
  ],
};

export default preview;
