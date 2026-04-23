// 컨텍스트 간 메시지 헬퍼
// SidePanel(jsx)에서는 이 파일을 import해서 쓰지 않음 — jsx는 TS 타입 불가.
// background(ts) / content script(ts) 에서 타입 안전하게 사용.

import type { ExtMessage, Product } from './types';

// ────────────────────────────────────────────────────────────────────
// 사이드패널 → background: 자동입력 요청
// ────────────────────────────────────────────────────────────────────
export function sendInject(product: Product): Promise<unknown> {
  return chrome.runtime.sendMessage({ type: 'inject', product } satisfies ExtMessage);
}

// ────────────────────────────────────────────────────────────────────
// 메시지 타입 가드
// ────────────────────────────────────────────────────────────────────
export function isExtMessage(msg: unknown): msg is ExtMessage {
  return typeof msg === 'object' && msg !== null && 'type' in msg;
}
