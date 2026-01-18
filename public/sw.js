// This file unregisters all service workers to prevent caching issues
// This ensures clean operation without service worker interference

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().then(() => {
        console.log('Service Worker unregistered');
      });
    });
  });
}
