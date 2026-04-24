/**
 * images.ts — Canvas 리사이즈 + IndexedDB 이미지 저장 유틸
 *
 * 사이드패널에서 업로드된 이미지를 1600px JPEG로 리사이즈한 뒤
 * IndexedDB(idb-keyval)에 Blob으로 저장한다.
 * product.imgs에는 여기서 반환한 키(문자열)만 저장하고,
 * content script가 자동입력 시 키로 File 객체를 복원해 file input에 주입한다.
 */

import { get, set, del } from 'idb-keyval';

// ─── 상수 ───────────────────────────────────────────────────────────────────

/** IndexedDB 키 prefix — 다른 idb-keyval 키와 충돌 방지 */
const IMG_KEY_PREFIX = 'img:';

/** 기본 최대 변 길이 (px) */
const DEFAULT_MAX_SIZE = 1600;

/** 기본 JPEG 품질 */
const DEFAULT_QUALITY = 0.85;

// ─── 유틸 ────────────────────────────────────────────────────────────────────

/**
 * 키가 올바른 img: prefix를 가지는지 검증.
 * 잘못된 키면 즉시 throw.
 */
function assertImgKey(key: string): void {
  if (!key.startsWith(IMG_KEY_PREFIX)) {
    throw new Error('INVALID_IMG_KEY');
  }
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * File을 Canvas로 1600px(긴 변 기준)로 리사이즈 + JPEG 압축.
 *
 * @param file    원본 이미지 파일
 * @param maxSize 최대 변 길이 (기본 1600)
 * @param quality JPEG 품질 0~1 (기본 0.85)
 * @returns 리사이즈된 Blob (image/jpeg)
 */
export async function resizeImage(
  file: File,
  maxSize: number = DEFAULT_MAX_SIZE,
  quality: number = DEFAULT_QUALITY,
): Promise<Blob> {
  // createImageBitmap으로 디코딩 (ServiceWorker/OffscreenCanvas 환경 호환)
  const bitmap = await createImageBitmap(file);

  const { width: origW, height: origH } = bitmap;

  // 긴 변 기준으로 비율 계산 (원본이 maxSize 이하면 확대 금지)
  const scale =
    Math.max(origW, origH) > maxSize
      ? maxSize / Math.max(origW, origH)
      : 1;

  const targetW = Math.round(origW * scale);
  const targetH = Math.round(origH * scale);

  // OffscreenCanvas 우선 시도 → 실패 시 일반 Canvas 폴백
  let blob: Blob;

  try {
    // OffscreenCanvas는 Web Worker / Service Worker 환경에서도 동작
    const offscreen = new OffscreenCanvas(targetW, targetH);
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context 획득 실패');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    blob = await offscreen.convertToBlob({ type: 'image/jpeg', quality });
  } catch {
    // 일반 <canvas> 폴백 (메인 스레드 환경)
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2d context 획득 실패');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('canvas.toBlob 변환 실패'));
        },
        'image/jpeg',
        quality,
      );
    });
  } finally {
    bitmap.close();
  }

  return blob;
}

/**
 * 이미지를 리사이즈 후 IndexedDB에 저장.
 *
 * @param file 원본 이미지 파일
 * @returns 저장된 키 (예: 'img:1714000000000-abc123')
 */
export async function saveImage(file: File): Promise<string> {
  const key = `${IMG_KEY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const blob = await resizeImage(file);
  await set(key, blob);
  return key;
}

/**
 * IndexedDB에서 키로 File 객체 복원.
 * content script에서 DataTransfer로 주입할 때 사용.
 *
 * @param key saveImage가 반환한 키
 * @returns File 또는 null (해당 키가 없으면)
 */
export async function loadImageAsFile(key: string): Promise<File | null> {
  assertImgKey(key);

  const blob = await get<Blob>(key);
  if (!blob) return null;

  // 파일명: prefix 제거 후 .jpg 확장자 부여
  const filename = key.slice(IMG_KEY_PREFIX.length) + '.jpg';
  return new File([blob], filename, { type: blob.type });
}

/**
 * IndexedDB에서 키로 이미지를 삭제.
 *
 * @param key saveImage가 반환한 키
 */
export async function deleteImage(key: string): Promise<void> {
  assertImgKey(key);
  await del(key);
}

/**
 * Blob을 data URL로 변환 (사이드패널 미리보기용).
 *
 * @param blob 변환할 Blob
 * @returns data URL 문자열
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader 읽기 실패'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 키로 이미지 data URL 반환 (미리보기 편의 함수).
 *
 * @param key saveImage가 반환한 키
 * @returns data URL 또는 null (해당 키가 없으면)
 */
export async function loadImageAsDataURL(key: string): Promise<string | null> {
  assertImgKey(key);

  const blob = await get<Blob>(key);
  if (!blob) return null;

  return blobToDataURL(blob);
}
