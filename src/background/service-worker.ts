// Background Service Worker (MV3)
// 역할:
//   1. 툴바 아이콘 클릭 → 사이드패널 오픈
//   2. SidePanel → content script 메시지 중계 (inject)
//   3. 활성 탭 URL 변경 → SidePanel에 알림

import type { ExtMessage } from '../lib/types';
import { isExtMessage } from '../lib/messaging';

// ────────────────────────────────────────────────────────────────────
// 설치 시 사이드패널 동작 설정
// ────────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[bunjang-helper] setPanelBehavior failed:', err));
});

// ────────────────────────────────────────────────────────────────────
// 메시지 라우팅: SidePanel → content script
// ────────────────────────────────────────────────────────────────────
// 활성 번개장터 탭으로 메시지 전달 (공통 헬퍼)
function forwardToBunjangTab(
  msg: ExtMessage,
  errorType: string,
  sendResponse: (resp: unknown) => void,
): void {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
    if (!tab?.id) {
      sendResponse({ type: errorType, ok: false, error: '활성 탭 없음', results: [{ field: 'all', ok: false, error: '활성 탭 없음' }] });
      return;
    }
    if (!tab.url?.includes('bunjang.co.kr')) {
      sendResponse({ type: errorType, ok: false, error: '번개장터 페이지가 아님: ' + tab.url, results: [{ field: 'all', ok: false, error: '번개장터 페이지가 아님: ' + tab.url }] });
      return;
    }
    chrome.tabs.sendMessage(tab.id, msg, (response) => {
      if (chrome.runtime.lastError) {
        const errMsg = 'content script 연결 실패: ' + chrome.runtime.lastError.message;
        sendResponse({ type: errorType, ok: false, error: errMsg, results: [{ field: 'all', ok: false, error: errMsg }] });
      } else {
        sendResponse(response);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (!isExtMessage(msg)) return;

  if (msg.type === 'inject') {
    console.log('[SW] inject 수신');
    forwardToBunjangTab(msg, 'inject:result', sendResponse);
    return true; // 비동기 응답 허용
  }

  if (msg.type === 'category:tree') {
    console.log('[SW] category:tree 수신');
    forwardToBunjangTab(msg, 'category:tree:result', sendResponse);
    return true;
  }

  if (msg.type === 'category:options') {
    console.log('[SW] category:options 수신', msg.path);
    forwardToBunjangTab(msg, 'category:options:result', sendResponse);
    return true;
  }
});

// ────────────────────────────────────────────────────────────────────
// 탭 URL 변경 감지 → SidePanel에 알림
// ────────────────────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url) return;

  const isBunjang = tab.url.includes('bunjang.co.kr');
  const message: ExtMessage = { type: 'tab:url', url: tab.url, isBunjang };
  chrome.runtime.sendMessage(message).catch(() => {});
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (!tab.url) return;
    const isBunjang = tab.url.includes('bunjang.co.kr');
    const message: ExtMessage = { type: 'tab:url', url: tab.url, isBunjang };
    chrome.runtime.sendMessage(message).catch(() => {});
  });
});
