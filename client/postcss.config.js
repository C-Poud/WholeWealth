import path from "path";

export default {
  plugins: {
    tailwindcss: {
      config: path.join(import.meta.dirname, "tailwind.config.js"),
    },
    autoprefixer: {},
  },
};
