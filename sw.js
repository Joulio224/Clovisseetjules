// Service Worker — Jeux de Collégiens
// Cache-first pour les assets statiques, network-first pour Firebase

const CACHE_NAME = 'jdc-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Installation — mise en cache des assets statiques
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS.filter(function(url) {
        return !url.startsWith('https://www.gstatic.com');
      }));
    }).catch(function() {})
  );
  self.skipWaiting();
});

// Activation — supprime les vieux caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — stratégie selon l'URL
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Firebase & API externes → toujours réseau (pas de cache)
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebase') ||
      url.includes('googleapis.com')) {
    return; // laisse le navigateur gérer normalement
  }

  // CDN (jspdf, firebase SDK) → cache-first
  if (url.includes('cdnjs.cloudflare.com') ||
      url.includes('gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(function() { return cached; });
      })
    );
    return;
  }

  // App shell (index.html + assets locaux) → network-first avec fallback cache
  if (event.request.mode === 'navigate' ||
      url.endsWith('.html') ||
      url.endsWith('.json') ||
      url.endsWith('.png')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('/index.html');
        });
      })
    );
  }
});
