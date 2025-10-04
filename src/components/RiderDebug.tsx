import React from 'react';

export default function RiderDebug() {
  const debugInfo = {
    currentUrl: window.location.href,
    pathname: window.location.pathname,
    hostname: window.location.hostname,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };

  console.log('🔍 Rider Debug Info:', debugInfo);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>🔍 Rider Portal Debug</div>
      <div>URL: {debugInfo.pathname}</div>
      <div>Host: {debugInfo.hostname}</div>
      <div>Time: {new Date().toLocaleTimeString()}</div>
      <div>Size: {debugInfo.viewport.width}x{debugInfo.viewport.height}</div>
      
      <div style={{ marginTop: '10px', padding: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
        <div style={{ fontWeight: 'bold' }}>✅ Component Status:</div>
        <div>• RiderAuth: Loading</div>
        <div>• Router: Active</div>
        <div>• Console: Check F12</div>
      </div>

      <div style={{ marginTop: '10px', fontSize: '11px', opacity: 0.8 }}>
        If you see this, the React app is working!
      </div>
    </div>
  );
}
