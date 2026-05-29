// =====================================================
// SERVICE WORKER - Aldian-Ai PWA
// =====================================================

const CACHE_NAME = 'liaa-ai-v1.0.0';
const STATIC_CACHE = 'liaa-ai-static-v1';
const DYNAMIC_CACHE = 'liaa-ai-dynamic-v1';

// File-file yang di-cache saat install
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// =====================================================
// INSTALL EVENT - Cache static assets
// =====================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// =====================================================
// ACTIVATE EVENT - Clean up old caches
// =====================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// =====================================================
// FETCH EVENT - Network First, fallback to Cache
// =====================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Lewati request ke API eksternal (tidak di-cache)
  if (url.hostname.includes('nexray.eu.cc') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Jika offline dan request ke API, kembalikan respons error JSON
        if (url.hostname.includes('nexray.eu.cc')) {
          return new Response(
            JSON.stringify({ status: false, result: 'Kamu sedang offline. Periksa koneksi internet kamu.' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      })
    );
    return;
  }

  // Strategi: Cache First untuk assets statis, Network First untuk halaman
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Kembalikan dari cache, lalu update di background
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, networkResponse.clone());
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // Tidak ada di cache, ambil dari network
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Simpan ke dynamic cache
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
          // Fallback ke halaman utama jika offline
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});

// =====================================================
// PUSH NOTIFICATION (Opsional - siap digunakan)
// =====================================================
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Ada pesan baru dari Liaa-Ai!',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: { dateOfArrival: Date.now(), primaryKey: 1 }
  };

  event.waitUntil(
    self.registration.showNotification('Aldian-Ai', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
