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
    // SidePanel에서 온 inject 요청 → 활성 탭의 content script로 전달
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) {
        sendResponse({ type: 'inject:result', results: [{ field: 'all', ok: false, error: '활성 탭 없음' }] });
        return;
      }

      // 번개장터 페이지인지 확인
      if (!tab.url?.includes('bunjang.co.kr')) {
        sendResponse({ type: 'inject:result', results: [{ field: 'all', ok: false, error: '번개장터 페이지가 아님. 현재 URL: ' + tab.url }] });
        return;
      }

      chrome.tabs.sendMessage(tab.id, msg, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ type: 'inject:result', results: [{ field: 'all', ok: false, error: 'content script 연결 실패: ' + chrome.runtime.lastError.message }] });
        } else {
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
