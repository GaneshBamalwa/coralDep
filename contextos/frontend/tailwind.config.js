/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#fbf8f3",
          surface: "#ffffff",
          elevated: "#f6f4ef",
          border: "rgba(15,23,32,0.06)",
        },
        accent: {
          DEFAULT: "#0b5f53",
          cta: "#0f7a64",
          muted: "#6b6b6b",
        },
        text: {
          primary: "#0f1720",
          secondary: "#6b6b6b",
        },
      },
      fontFamily: {
        display: ['"GT Canon VF Variable L Black"', "sans-serif"],
        sans: ['"GT Canon VF Variable L Black"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
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
