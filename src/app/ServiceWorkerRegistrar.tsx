"use client";

import { useEffect } from "react";

// Mounts in the root layout. In production it registers /sw.js so the
// app shell is cached and Bloom can open even when the user is offline.
// In dev mode it actively unregisters any previously installed SW so a
// stale prod build can't poison the hot-reload loop.
export function ServiceWorkerRegistrar() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) return;

        if (process.env.NODE_ENV !== "production") {
            // Dev mode: clean up any SW we registered in a previous prod
            // build so HMR isn't intercepted.
            navigator.serviceWorker
                .getRegistrations()
                .then((regs) => regs.forEach((r) => r.unregister()))
                .catch(() => { /* ignore */ });
            return;
        }

        navigator.serviceWorker
            .register("/sw.js", { scope: "/", updateViaCache: "none" })
            .catch((err) => {
                console.warn("SW registration failed:", err);
            });
    }, []);

    return null;
}
