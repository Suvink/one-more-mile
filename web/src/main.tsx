import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import Leave from './pages/Leave';
import Listen from './pages/Listen';
import Home from './pages/Home';
import Admin from './pages/Admin';
import './styles.css';

const router = createHashRouter([
  { path: '/', element: <Home /> },
  { path: '/leave', element: <Leave /> },
  { path: '/leave/:bib', element: <Leave /> },
  { path: '/for/:bib', element: <Listen /> },
  { path: '/admin', element: <Admin /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
