/* RaushanSYNC Science PWA Service Worker */
const CACHE_VERSION = 'science-v1.0.2.9';
const CORE_CACHE = 'rs-core-' + CACHE_VERSION;
const RUNTIME_CACHE = 'rs-runtime-' + CACHE_VERSION;
const OFFLINE_URL = '/offline.html';
const MAX_RUNTIME_ENTRIES = 60;

const CORE_ASSETS = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/script.js',
  '/ai-chat.js',
  '/components/nav.html',
  '/components/footer.html',
  '/components/support-cta.html',
  '/favicon.ico',
  '/favicon-48x48.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/about/',
  '/class06/',
  '/class07/',
  '/class08/',
  '/class09/',
  '/class10/',
  '/class11/',
  '/class12/',
  '/video-lessons/class06/chapter01-the-wonderful-world-of-science/index.html',

  // Newly added Class 07 notes (precache important pages)
  '/notes/class07/chapter01-nutrition-in-plants/',
  '/notes/class07/chapter01-nutrition-in-plants/index.html',
  '/notes/class07/chapter01-nutrition-in-plants/congratulations.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-1/index.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-1/quiz1.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-2/index.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-2/quiz2.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-3/index.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-3/quiz3.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-4/index.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-4/quiz4.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-5/index.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-5/quiz5.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-6/index.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-6/quiz6.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-7/index.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-7/quiz7.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-8/index.html',
  '/notes/class07/chapter01-nutrition-in-plants/core-concept-8/quiz8.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => ![CORE_CACHE, RUNTIME_CACHE].includes(key))
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// For later: refactor to prefix array once JS architecture is finalized
function isNotesOrPractice(pathname) {
  return pathname.startsWith('/notes/')
    || pathname.startsWith('/practice/')
    || pathname.startsWith('/practice-advanced/')
    || pathname.startsWith('/practice-solution/')
    || pathname.startsWith('/video-lessons/');
}

function isComponent(pathname) {
  return pathname.startsWith('/components/');
}

function isStaticAsset(request, pathname) {
  if (pathname.startsWith('/assets/')) return true;
  if (request.destination) {
    return ['style', 'script', 'image', 'font'].includes(request.destination);
  }
  return false;
}

function shouldCacheResponse(response) {
  return response && response.status === 200 && response.type === 'basic';
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await cache.delete(keys[0]);
  if (keys.length - 1 > maxEntries) {
    return trimCache(cacheName, maxEntries);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (shouldCacheResponse(response)) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
      trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
    }
    return response;
  } catch (error) {
    if (request.destination === 'document') {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (shouldCacheResponse(response)) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
      trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.destination === 'document') {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  // Keep HTML fresh so newly deployed lesson content is not trapped behind cache-first routing.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(request, pathname) || isComponent(pathname) || isNotesOrPractice(pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
