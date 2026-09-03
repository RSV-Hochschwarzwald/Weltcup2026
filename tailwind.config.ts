import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#b6d7ff",
          300: "#84baff",
          400: "#4b93ff",
          500: "#1f6cf5",
          600: "#124fd1",
          700: "#123ea8",
          800: "#153586",
          900: "#152f6d",
          950: "#0f1d42",
        },
        snow: {
          50: "#f8fafc",
          100: "#f1f5f9",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 0 rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
