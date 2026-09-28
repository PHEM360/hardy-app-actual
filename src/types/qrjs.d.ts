// Minimal types for the qr.js internals used by src/lib/compactQr.ts.
declare module "qr.js/lib/QRCode" {
  interface QRDataSegment {
    mode: number;
    getLength(): number;
    write(buffer: { put: (num: number, length: number) => void }): void;
  }
  export default class QRCode {
    constructor(typeNumber: number, errorCorrectLevel: number);
    dataList: QRDataSegment[];
    modules: boolean[][];
    addData(data: string): void;
    make(): void;
    getModuleCount(): number;
  }
}

declare module "qr.js/lib/ErrorCorrectLevel" {
  const ErrorCorrectLevel: { L: number; M: number; Q: number; H: number };
  export default ErrorCorrectLevel;
}

declare module "qr.js/lib/mode" {
  const QRMode: { MODE_NUMBER: number; MODE_ALPHA_NUM: number; MODE_8BIT_BYTE: number; MODE_KANJI: number };
  export default QRMode;
}
