// Service Worker — no-op. Sync runs via bookmarklet in the user's browser.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
