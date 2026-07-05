/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bakery: {
          brand: "var(--color-brand)",
          dark: "var(--color-brand-dark)",
          soft: "var(--color-brand-soft)",
          gold: "var(--color-bakery)",
          cream: "var(--color-cream)",
          creamStrong: "var(--color-cream-strong)",
          card: "var(--color-card)",
          ink: "var(--color-text)",
          muted: "var(--color-text-soft)",
          border: "var(--color-border)",
          success: "var(--color-success)",
          successSoft: "var(--color-success-soft)",
          warning: "var(--color-warning)",
          warningSoft: "var(--color-warning-soft)",
          danger: "var(--color-danger)",
          dangerSoft: "var(--color-danger-soft)"
        }
      },
      borderRadius: {
        bakerySm: "var(--radius-sm)",
        bakeryMd: "var(--radius-md)",
        bakeryLg: "var(--radius-lg)",
        bakeryXl: "var(--radius-xl)"
      },
      boxShadow: {
        soft: "var(--shadow-card)",
        warm: "var(--shadow-card-hover)",
        button: "var(--shadow-button)",
        nav: "var(--shadow-bottom-nav)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};
