import React from 'react';
import { createRoot } from 'react-dom/client';
import MobilePWA from './MobilePWA.jsx';

// Mobile PWA runs full-screen — no iOS frame in production. The IOSFrame.jsx
// wrapper is kept in this folder for design-canvas reuse / preview only.
const DEFAULT_TWEAKS = {
  dark: false,
  accent: 'oklch(68% 0.15 45)',
};

function App() {
  return <MobilePWA tweaks={DEFAULT_TWEAKS} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');
createRoot(root).render(<App />);
