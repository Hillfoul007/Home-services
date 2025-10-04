// Cache buster script to clear PWA cache and fix URL corruption
(function() {
  console.log('🧹 Cache Buster: Starting cleanup...');
  
  // Clear localStorage
  try {
    localStorage.clear();
    console.log('✅ localStorage cleared');
  } catch (e) {
    console.warn('⚠️ Could not clear localStorage:', e);
  }
  
  // Clear sessionStorage
  try {
    sessionStorage.clear();
    console.log('✅ sessionStorage cleared');
  } catch (e) {
    console.warn('⚠️ Could not clear sessionStorage:', e);
  }
  
  // Clear IndexedDB
  if ('indexedDB' in window) {
    try {
      indexedDB.databases().then(databases => {
        databases.forEach(db => {
          indexedDB.deleteDatabase(db.name);
        });
      });
      console.log('✅ IndexedDB cleared');
    } catch (e) {
      console.warn('⚠️ Could not clear IndexedDB:', e);
    }
  }
  
  // Unregister service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister().then(function() {
          console.log('✅ Service Worker unregistered:', registration);
        });
      }
    });
  }
  
  // Clear cache storage
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
      });
      console.log('✅ Cache storage cleared');
    });
  }
  
  console.log('🧹 Cache Buster: Cleanup complete! Please refresh the page.');
  
  // Auto refresh after 2 seconds
  setTimeout(() => {
    window.location.reload(true);
  }, 2000);
})();
