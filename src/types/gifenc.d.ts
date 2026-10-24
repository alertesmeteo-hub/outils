declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: number[][]; delay?: number; repeat?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(data: Uint8ClampedArray | Uint8Array, maxColors: number, options?: Record<string, unknown>): number[][];
  export function applyPalette(data: Uint8ClampedArray | Uint8Array, palette: number[][], format?: string): Uint8Array;
}
