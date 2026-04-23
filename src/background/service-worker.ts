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
chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (!isExtMessage(msg)) return;

  if (msg.type === 'inject') {
    // currentWindow 대신 lastFocusedWindow — 서비스 워커엔 "현재 창" 개념 없음
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
      console.log('[SW] inject 수신, 탭:', tab?.id, tab?.url);

      if (!tab?.id) {
        sendResponse({ type: 'inject:result', results: [{ field: 'all', ok: false, error: '활성 탭 없음' }] });
        return;
      }

      if (!tab.url?.includes('bunjang.co.kr')) {
        sendResponse({ type: 'inject:result', results: [{ field: 'all', ok: false, error: '번개장터 페이지가 아님: ' + tab.url }] });
        return;
      }

      console.log('[SW] content script에 sendMessage 시도, tabId:', tab.id);
      chrome.tabs.sendMessage(tab.id, msg, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[SW] sendMessage 실패:', chrome.runtime.lastError.message);
          sendResponse({ type: 'inject:result', results: [{ field: 'all', ok: false, error: 'content script 연결 실패: ' + chrome.runtime.lastError.message }] });
        } else {
          console.log('[SW] content script 응답:', response);
          sendResponse(response);
        }
      });
    });
    return true; // 비동기 응답 허용
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
