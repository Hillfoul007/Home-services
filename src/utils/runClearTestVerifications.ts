import clearTestVerifications from './clearTestVerifications';

// Run the clear function immediately
clearTestVerifications();

// Also add to window for manual execution
if (typeof window !== 'undefined') {
  (window as any).clearTestVerifications = clearTestVerifications;
  console.log('🧹 Test verification cleaner is available as window.clearTestVerifications()');
}

export default clearTestVerifications;
