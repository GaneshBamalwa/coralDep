/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0a0a0f",
          surface: "#0f0f1a",
          elevated: "#151524",
          border: "#1e1e32",
        },
        cyan: {
          DEFAULT: "#00d4ff",
          dim: "#00d4ff22",
          muted: "#00d4ff66",
        },
        amber: {
          DEFAULT: "#f59e0b",
          dim: "#f59e0b22",
          muted: "#f59e0b66",
        },
        green: {
          DEFAULT: "#10b981",
          dim: "#10b98122",
          muted: "#10b98166",
        },
        red: {
          DEFAULT: "#ef4444",
          dim: "#ef444422",
          muted: "#ef444466",
        },
        text: {
          primary: "#e2e8f0",
          secondary: "#94a3b8",
          muted: "#475569",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "monospace"],
        sans: ["Inter", "sans-serif"],
      },
      animation: {
        shimmer: "shimmer 1.8s infinite linear",
        pulse_slow: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        fadeIn: {
          from: { opacity: 0, transform: "translateY(8px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: 0, transform: "translateX(-12px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
