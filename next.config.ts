import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Day manifests are read from disk at request time; make sure they ship with the API functions.
  outputFileTracingIncludes: { "/api/**": ["./content/days/**/*.json"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
