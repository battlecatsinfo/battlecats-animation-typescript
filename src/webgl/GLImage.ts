import { BitmapImage } from "../util/BitmapImage";

export class GLImage extends BitmapImage {
	constructor(
		bitmap: ImageBitmap,
		public readonly tex: WebGLTexture,
		x = 0,
		y = 0,
		w = bitmap.width,
		h = bitmap.height
	) {
		super(bitmap, x, y, w, h);
	}

	getSubimage(i: number, j: number, k: number, l: number): GLImage {
		return new GLImage(this.bitmap, this.tex, this.x + i, this.y + j, k, l);
	}
};
