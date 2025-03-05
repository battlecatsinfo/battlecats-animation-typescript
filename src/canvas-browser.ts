export type CanvasLike = HTMLCanvasElement | OffscreenCanvas;
export type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Bitmap = ImageBitmap;

export interface DOMMatrix {};
// export interface DOMMatrixReadOnly {};
export interface DOMPoint { x: number; y: number; };
// export interface DOMPointReadOnly extends DOMPoint {};

export function createBitmap(blob: Blob) {
	return createImageBitmap(blob, { premultiplyAlpha: 'premultiply' });
}
