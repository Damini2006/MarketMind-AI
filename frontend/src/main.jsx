import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import './index.css'

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Capture the browser's install prompt as early as possible.
// `beforeinstallprompt` fires ONCE, usually moments after load — often before
// React mounts the component that shows the Install button — and is never
// re-fired, so a listener attached later misses it and no Install button can
// be offered. Stash it and broadcast instead.
window.__deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-install-available'));
});
window.addEventListener('appinstalled', () => {
  window.__deferredInstallPrompt = null;
  window.dispatchEvent(new CustomEvent('pwa-installed'));
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)