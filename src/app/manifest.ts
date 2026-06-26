import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Bloom — Discover what you love",
        short_name: "Bloom",
        description:
            "A warm, voice-first companion that helps you discover your passion.",
        start_url: "/",
        display: "standalone",
        background_color: "#fffaf7",
        theme_color: "#ec4899",
        orientation: "portrait",
        lang: "en",
        icons: [
            {
                src: "/favicon.ico",
                sizes: "any",
                type: "image/x-icon",
            },
        ],
    };
}
