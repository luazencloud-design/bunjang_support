import React from 'react';
import { createRoot } from 'react-dom/client';
import SidePanel from './SidePanel.jsx';

// Default tweaks (matches design TWEAK_DEFAULTS in Bunjang Helper Designs.html).
// TODO: persist to chrome.storage.local + wire up the in-panel settings UI.
const DEFAULT_TWEAKS = {
  dark: false,
  accent: '#151515',  // 검정 메인 컬러
};

function App() {
  return <SidePanel tweaks={DEFAULT_TWEAKS} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');
createRoot(root).render(<App />);
