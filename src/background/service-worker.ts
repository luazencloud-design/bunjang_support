// Background service worker — opens side panel when toolbar action is clicked.
// (Chrome 114+ Side Panel API)

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[bunjang-helper] setPanelBehavior failed:', err));
});

// Future: relay messages between side panel and content script
//   - 'inject:bunjang' — push form data into the bunjang new-product page
//   - 'diag:report'    — receive per-field success/fail back from content script

export {};
