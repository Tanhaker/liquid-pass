import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic Token Mapping
        bg: {
          page: "var(--bg-page)",
          card: "var(--bg-card)",
          panel: "var(--bg-panel-nested)",
        },
        border: {
          DEFAULT: "var(--border-default)",
          default: "var(--border-default)",
          strong: "var(--border-strong)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        accent: {
          primary: "var(--accent-primary)",
          text: "var(--accent-text)",
          glow: "var(--accent-glow)",
        },
        chip: {
          bg: "var(--chip-bg)",
          text: "var(--chip-text)",
        },
        status: {
          warning: "var(--status-warning)",
          danger: "var(--status-danger)",
          info: "var(--status-info)",
        },
        // Direct compatibility aliases so all existing classes react dynamically
        uranium: {
          DEFAULT: "var(--accent-text)",
          glow: "var(--accent-glow)",
          dim: "var(--accent-primary)",
        },
        aviation: {
          DEFAULT: "var(--status-warning)",
          glow: "#FFB34D",
          dim: "#D47E0A",
        },
        alabaster: {
          DEFAULT: "var(--text-primary)",
          dim: "var(--text-secondary)",
          muted: "var(--text-tertiary)",
        },
        zincGrey: {
          DEFAULT: "var(--text-secondary)",
          light: "var(--text-tertiary)",
          dark: "var(--text-secondary)",
        },
        dark: {
          DEFAULT: "var(--bg-page)",
          base: "var(--bg-page)",
          card: "var(--bg-card)",
          surface: "var(--bg-panel-nested)",
          surfaceHover: "var(--border-default)",
          border: "var(--border-default)",
          borderMuted: "var(--border-default)",
        },
        periwinkle: {
          DEFAULT: "var(--status-info)",
          dim: "#556DD9",
        },
      },
      fontFamily: {
        header: ["'Cabinet Grotesk'", "sans-serif"],
        body: ["'General Sans'", "sans-serif"],
        mono: ["var(--font-space-mono)", "'Space Mono'", "monospace"],
      },
      boxShadow: {
        'glow-uranium': '0 0 25px -5px rgba(152, 255, 26, 0.45)',
        'glow-amber': '0 0 25px -5px rgba(255, 159, 28, 0.45)',
        'grunge': 'var(--shadow-grunge)',
        'grunge-uranium': '4px 4px 0px 0px var(--accent-primary)',
        'grunge-amber': '4px 4px 0px 0px var(--status-warning)',
        'card': 'var(--shadow-card)',
      },
      backgroundImage: {
        'decay-gradient': 'linear-gradient(135deg, var(--accent-primary) 0%, var(--status-warning) 60%, var(--bg-card) 100%)',
        'decay-bar': 'linear-gradient(90deg, var(--accent-primary) 0%, var(--status-warning) 50%, var(--border-default) 100%)',
      }
    },
  },
  plugins: [],
};
export default config;
