import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /*
         * Semantic tokens — what a colour is FOR, not what it looks like.
         *
         * The literal tokens below (obsidian/alabaster) say "that near-black"
         * and "that near-white", so inverting the storefront by redefining them
         * would make every name a lie. These resolve through CSS variables
         * instead, which lets the storefront run warm-dark while the admin runs
         * light from the same class names — see :root and .theme-admin in
         * globals.css.
         */
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
          overlay: "rgb(var(--surface-overlay) / <alpha-value>)",
          // A deliberately light well for product photography. Real product
          // shots have white backgrounds; bleeding them onto a dark page punches
          // harsh rectangles, so images sit framed on this instead.
          tile: "rgb(var(--surface-tile) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          subtle: "rgb(var(--ink-subtle) / <alpha-value>)",
        },
        /*
         * Hairlines carry their alpha in the token rather than at the call site.
         * Scattered `border-obsidian/10` worked on a light page but goes muddy
         * on a dark one, and light-on-dark needs different alpha than
         * dark-on-light to read the same.
         */
        line: {
          DEFAULT: "rgb(var(--line) / 0.12)",
          strong: "rgb(var(--line) / 0.24)",
        },

        // --- Literal tokens. Still used by the admin, which stays light. ---
        obsidian: "#121212",
        alabaster: "#F9F8F6",
        gold: {
          DEFAULT: "#CDAD54",
          light: "#E4C767",
          dark: "#A9873A",
        },
        sage: {
          DEFAULT: "#8A9A86",
          light: "#A6B4A2",
          dark: "#6E7C6B",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        // Alpha used to be baked in here, so this token could never be opaque.
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // Roboto for everything functional, Playfair for everything expressive.
        sans: ["var(--font-sans)", "Roboto", "system-ui", "-apple-system", "sans-serif"],
        serif: ["var(--font-serif)", "Playfair Display", "Georgia", "serif"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        widest2: "0.2em",
      },
      maxWidth: {
        "8xl": "90rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        marquee: "marquee 32s linear infinite",
        "fade-up": "fade-up 0.6s ease-out forwards",
      },
      /*
       * Elevation is theme-dependent. A dark surface cannot be lifted by a
       * darker drop shadow — it needs a light top edge plus depth beneath —
       * whereas the light admin still wants a soft obsidian-tinted shadow.
       */
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};

export default config;
