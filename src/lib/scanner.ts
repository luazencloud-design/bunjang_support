// 바코드 스캐너 — getUserMedia + ZXing
//
// 사용:
//   const scanner = new BarcodeScanner(videoEl);
//   await scanner.start((code) => {
//     console.log('스캔됨:', code.text, code.format);
//   });
//   ...
//   scanner.stop();

import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from '@zxing/browser';
import {
  BarcodeFormat,
  DecodeHintType,
  type Result,
} from '@zxing/library';

export interface ScanResult {
  text: string;            // 바코드 값
  format: string;          // 바코드 형식 (EAN_13, CODE_128, ...)
  timestamp: number;
}

export type ScanCallback = (result: ScanResult) => void;

export class BarcodeScanner {
  private reader: BrowserMultiFormatReader;
  private controls: IScannerControls | null = null;
  private videoEl: HTMLVideoElement;
  private currentDeviceId: string | null = null;

  constructor(videoEl: HTMLVideoElement) {
    this.videoEl = videoEl;

    // JAN/EAN/UPC + 일반 바코드 우선 탐지
    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    this.reader = new BrowserMultiFormatReader(hints);
  }

  /**
   * 사용 가능한 카메라 장치 목록.
   */
  static async listCameras(): Promise<MediaDeviceInfo[]> {
    try {
      // getUserMedia 호출로 권한 받아둬야 deviceId/label이 노출됨
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(t => t.stop());
    } catch {
      // 권한 거부 — 빈 목록 반환
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput');
  }

  /**
   * 스캔 시작.
   *
   * @param onScan       바코드 인식 시 호출
   * @param deviceId     특정 카메라 사용 (없으면 후면 카메라 자동 선택)
   * @param onError      decode 실패 시 호출 (선택, 디버깅용)
   */
  async start(
    onScan: ScanCallback,
    deviceId?: string,
    onError?: (err: unknown) => void,
  ): Promise<void> {
    if (this.controls) return; // 이미 실행 중

    let target = deviceId;
    if (!target) {
      // 후면 카메라 우선 선택
      const cams = await navigator.mediaDevices.enumerateDevices()
        .then(ds => ds.filter(d => d.kind === 'videoinput'));
      const back = cams.find(c =>
        /back|rear|environment|후면|뒤/i.test(c.label),
      );
      target = back?.deviceId ?? cams[cams.length - 1]?.deviceId;
    }
    this.currentDeviceId = target ?? null;

    const constraints: MediaStreamConstraints = target
      ? { video: { deviceId: { exact: target } } }
      : { video: { facingMode: { ideal: 'environment' } } };

    this.controls = await this.reader.decodeFromConstraints(
      constraints,
      this.videoEl,
      (result: Result | undefined, err: unknown) => {
        if (result) {
          onScan({
            text: result.getText(),
            format: BarcodeFormat[result.getBarcodeFormat()] ?? 'UNKNOWN',
            timestamp: Date.now(),
          });
        }
        // err는 NotFoundException(매 프레임마다 발생, 정상)이라 일반적으로 무시
        if (err && onError) onError(err);
      },
    );
  }

  /**
   * 카메라 전환 (후면 ↔ 전면).
   */
  async switchCamera(): Promise<void> {
    const cams = await BarcodeScanner.listCameras();
    if (cams.length < 2) return;
    const idx = cams.findIndex(c => c.deviceId === this.currentDeviceId);
    const next = cams[(idx + 1) % cams.length];
    this.stop();
    // 약간 대기 후 재시작 (같은 카메라 재오픈 시 충돌 방지)
    await new Promise(r => setTimeout(r, 150));
  }

  /**
   * 한 장의 정지 사진 캡처.
   */
  capturePhoto(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const v = this.videoEl;
      if (!v.videoWidth || !v.videoHeight) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(v, 0, 0);
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.92,
      );
    });
  }

  /**
   * 스캔 정지 + 카메라 해제.
   */
  stop(): void {
    if (this.controls) {
      this.controls.stop();
      this.controls = null;
    }
  }
}
