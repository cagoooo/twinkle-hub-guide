/* Twinkle Hub 教師指南 — Service Worker
 * 更新版本只需改 BUILD_VERSION（或跑 scripts/bump-version.ps1）。
 * sw.js 的 byte 一變，瀏覽器就會偵測為新版 → 觸發更新通知。
 */
const BUILD_VERSION = '2026.06.04-1';
const CACHE = 'twinkle-hub-' + BUILD_VERSION;

const PRECACHE = [
  './',
  './index.html',
  './favicon.svg',
  './favicon.ico',
  './apple-touch-icon.png',
  './manifest.webmanifest',
  './assets/og-cover.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

// 安裝：預快取核心資源。不自動 skipWaiting —— 等使用者在通知列點「重新整理」。
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(PRECACHE.map((u) => cache.add(u).catch(() => {})))
    )
  );
});

// 啟用：清掉舊版快取，接管頁面，並廣播「已啟用新版」。
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('twinkle-hub-') && k !== CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.postMessage({ type: 'SW_ACTIVATED', version: BUILD_VERSION }));
  })());
});

// 收到頁面「立即更新」指令 → 退場讓新版接手。
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;          // 只處理同源
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // version.json：永遠拿最新（network-first，失敗才用快取）
  if (url.pathname.endsWith('version.json')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // HTML / 導航：network-first，確保拿到最新頁面；離線才回快取。
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 其他靜態資源（圖片 / svg / manifest）：cache-first + 背景更新。
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
