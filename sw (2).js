// Service Worker — Jeux de Collégiens PWA + OneSignal
// Cache-first pour les assets statiques, network-first pour Firebase

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'jdc-v4';

// Fichiers à mettre en cache pour le mode hors ligne
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Installation — mise en cache des assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function(err) {
        console.warn('[SW] Certains assets non cachés:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activation — supprime les anciens caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — stratégie Network First pour Firebase, Cache First pour les assets statiques
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Firebase et APIs externes → toujours réseau (pas de cache)
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebase') ||
      url.includes('googleapis.com')) {
    return; // Laisse passer normalement
  }

  // Assets statiques → Cache First avec fallback réseau
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Met en cache les nouvelles ressources statiques
        if (response && response.status === 200 && event.request.method === 'GET') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Hors ligne et pas en cache → page principale
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Gestion des notifications push (pour plus tard)
self.addEventListener('push', function(event) {
  if (!event.data) return;
  var data = event.data.json();
  self.registration.showNotification(data.title || 'Jeux de Collégiens', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: data
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
