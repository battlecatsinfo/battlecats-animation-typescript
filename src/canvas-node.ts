import { loadImage } from "canvas";

export {
	Canvas as CanvasLike,
	CanvasRenderingContext2D as Canvas2D,
	DOMMatrix,
	// DOMMatrix as DOMMatrixReadOnly,
	DOMPoint,
	// DOMPoint as DOMPointReadOnly,
	Image as Bitmap
} from "canvas";

export async function createBitmap(blob: Blob) {
	return await loadImage(Buffer.from(new Uint8Array(await blob.arrayBuffer()).buffer));
}
