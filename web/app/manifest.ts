import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RollCall",
    short_name: "RollCall",
    description: "One shared photo roll for every event.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1621",
    theme_color: "#0e1621",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
