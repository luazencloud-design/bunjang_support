// Service Worker — 번개장터 스캐너 PWA
// 역할:
//   1. 앱 셸 캐싱 (오프라인에서도 UI 로드)
//   2. 네트워크 우선, 실패 시 캐시 (stale-while-revalidate 변형)
//   3. 메루카리/Frankfurter API는 항상 네트워크 (캐시 안 함)

const CACHE = 'bunjang-scanner-v1';

// 앱 셸 — 빌드 시 자동 추가될 자산은 fetch 핸들러에서 동적 캐싱
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
];

// 항상 네트워크로 가야 하는 origin
const NO_CACHE_ORIGINS = [
  'jp.mercari.com',
  'api.frankfurter.dev',
  'api.frankfurter.app',
  'generativelanguage.googleapis.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 외부 API/사이트는 항상 네트워크
  if (NO_CACHE_ORIGINS.some((h) => url.hostname.includes(h))) {
    return;
  }

  // GET 외 요청 (POST/PUT 등) 은 캐시 안 함
  if (event.request.method !== 'GET') return;

  // 네트워크 우선, 실패 시 캐시 폴백 + 응답을 캐시에 백필
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // opaque/redirect 응답은 캐시 안 함
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || Response.error()),
      ),
  );
});
