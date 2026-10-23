const CACHE = "memento-shell-v4";
const SHELL = [
  "/",
  "/logo.svg",
  "/favicon.svg",
  "/icon-192.png",
  "/manifest.webmanifest",
  "/insignia/infanterie.svg",
  "/insignia/panzer.svg",
  "/insignia/artillerie.svg",
  "/insignia/luftwaffe.svg",
  "/insignia/fliegerabwehr.svg",
  "/insignia/genie.svg",
  "/insignia/rettung.svg",
  "/insignia/logistik.svg",
  "/insignia/sanitaet.svg",
  "/insignia/fuehrungsunterstuetzung.svg",
  "/insignia/abc.svg",
  "/insignia/militaerpolizei.svg",
  "/insignia/spezialkraefte.svg",
  "/insignia/nachrichtendienst.svg",
  "/insignia/seelsorge.svg",
  "/insignia/rotkreuzdienst.svg",
  "/insignia/generalstab.svg",
  "/insignia/justiz.svg",
  "/insignia/territorial.svg",
  "/insignia/ppd.svg",
  "/insignia/bereitschaft.svg",
  "/insignia/militaermusik.svg",
  "/insignia/sport.svg",
  "/insignia/armeefuehrung.svg",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      const response = await fetch("/");
      const html = await response.text();
      const assets = [
        ...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g),
      ].map((match) => match[1].replaceAll("&amp;", "&"));
      await Promise.allSettled(
        [...new Set(assets)].map((asset) => cache.add(asset)),
      );
    })(),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k !== CACHE &&
                (k.startsWith("memento-shell-") ||
                  k.startsWith("feldbuch-shell-")),
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/share/") ||
    url.pathname.startsWith("/auth/")
  )
    return;
  // Cache only the data-free shell/static assets. API, shares and photos bypass it.
  if (
    url.pathname.startsWith("/_next/static/") ||
    SHELL.includes(url.pathname)
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (
            response.ok &&
            (!response.headers.get("content-type")?.includes("text/html") ||
              url.pathname === "/")
          ) {
            const copy = response.clone();
            void caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || Response.error()),
        ),
    );
  } else if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/").then((cached) => cached || Response.error()),
      ),
    );
});
