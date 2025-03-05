declare module 'gifenc' {

	export class GIFEncoder {
		new (): GIFEncoder;
		writeFrame(data: Uint8Array | number[], width: number, height: number, options?: object): void;
		finish(): void;
		bytes(): Uint8Array;
	}

	type Palette = number[][];

	export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: object): Palette;

	export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, padlette: Palette): Uint8Array;
}
