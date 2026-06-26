/* Bloom service worker.
 *
 * Strategy:
 *   - Navigations (HTML): network-first; fall back to cached HTML;
 *     fall back to the tiny inline offline page below.
 *   - Static assets (/_next/static/*, /icons, images, fonts):
 *     stale-while-revalidate, since they're hash-versioned in prod.
 *   - API routes (/api/*): always network; we never cache AI responses.
 *
 * Bump CACHE_VERSION whenever the offline shell changes so old clients
 * upgrade cleanly.
 */

const CACHE_VERSION = "bloom-v1";
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Bloom — Offline</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #fce7f3 0%, #fff1f2 50%, #fffbeb 100%);
        color: #1f2937;
        text-align: center;
        padding: 2rem;
      }
      .card { max-width: 22rem; }
      .blossom { font-size: 3.5rem; animation: pulse 3s ease-in-out infinite; display: inline-block; }
      h1 { font-size: 1.5rem; color: #db2777; margin: .5rem 0 .25rem; }
      p { color: #52525b; line-height: 1.5; }
      button {
        margin-top: 1.5rem;
        background: #18181b;
        color: white;
        font-weight: 600;
        font-size: .875rem;
        padding: .75rem 1.5rem;
        border: none;
        border-radius: 9999px;
        cursor: pointer;
      }
      button:hover { background: #27272a; }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <span class="blossom">🌸</span>
      <h1>Bloom is offline</h1>
      <p>Your chat is saved on this device. Reconnect to keep talking with Bloom.</p>
      <button onclick="location.reload()">Try again</button>
    </div>
  </body>
</html>`;

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(RUNTIME_CACHE);
            // Pre-warm just the root so a first-time offline hit still
            // returns something nice.
            await cache.put(
                new Request("/__offline"),
                new Response(OFFLINE_HTML, {
                    headers: { "Content-Type": "text/html; charset=utf-8" },
                }),
            );
            await self.skipWaiting();
        })(),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            // Drop any old caches from previous versions.
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((k) => !k.startsWith(CACHE_VERSION))
                    .map((k) => caches.delete(k)),
            );
            await self.clients.claim();
        })(),
    );
});

function isApiRequest(url) {
    return url.pathname.startsWith("/api/");
}

function isStaticAsset(url) {
    return (
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/icons/") ||
        /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(
            url.pathname,
        )
    );
}

async function networkFirstNavigation(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    try {
        const fresh = await fetch(request);
        // Only cache successful navigations.
        if (fresh && fresh.ok && fresh.type === "basic") {
            cache.put(request, fresh.clone()).catch(() => { /* ignore */ });
        }
        return fresh;
    } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        const offline = await cache.match("/__offline");
        return (
            offline ||
            new Response(OFFLINE_HTML, {
                headers: { "Content-Type": "text/html; charset=utf-8" },
            })
        );
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    const networkFetch = fetch(request)
        .then((response) => {
            if (response && response.ok && response.type === "basic") {
                cache.put(request, response.clone()).catch(() => { /* ignore */ });
            }
            return response;
        })
        .catch(() => cached);
    return cached || networkFetch;
}

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Never intercept API routes — let them succeed or fail naturally
    // so the client-side error UI can react.
    if (isApiRequest(url)) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirstNavigation(request));
        return;
    }

    if (isStaticAsset(url)) {
        event.respondWith(staleWhileRevalidate(request));
    }
});
