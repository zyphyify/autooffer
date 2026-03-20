import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#FAFAF8", cream: "#F5F3EF", navy: "#0A2540", "navy-light": "#1B3A4B",
          gold: "#C4A265", "gold-light": "#E8D5B5", sage: "#3D6B50", "sage-bg": "#EDF3EF",
          red: "#C0392B", "red-bg": "#FDF0EE", amber: "#B8860B", "amber-bg": "#FDF8ED",
          border: "#E8E3DB", "border-light": "#F0ECE6", "text-med": "#4A5568", "text-light": "#8B95A5",
        },
      },
      fontFamily: { serif: ['"Instrument Serif"', "serif"], sans: ['"DM Sans"', "sans-serif"] },
      boxShadow: {
        card: "0 1px 3px rgba(10,37,64,0.04), 0 4px 12px rgba(10,37,64,0.03)",
        "card-md": "0 2px 8px rgba(10,37,64,0.06), 0 8px 24px rgba(10,37,64,0.04)",
      },
      borderRadius: { card: "16px", btn: "10px" },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
export default config;
