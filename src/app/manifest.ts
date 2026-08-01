import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Betting Game Scorer",
    short_name: "Game Scorer",
    description: "Score Betting Game and Oh Hell rounds, online or offline.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#103f36",
    orientation: "portrait-primary",
    categories: ["games", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
