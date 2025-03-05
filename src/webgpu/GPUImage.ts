import { BitmapImage } from "../util/BitmapImage";

export class GPUImage extends BitmapImage {
	constructor(
		bitmap: ImageBitmap,
		public readonly tex: GPUTexture,
		public readonly group: GPUBindGroup,
		x = 0,
		y = 0,
		w = bitmap.width,
		h = bitmap.height
	) {
		super(bitmap, x, y, w, h);
	}

	getSubimage(i: number, j: number, k: number, l: number): GPUImage {
		return new GPUImage(this.bitmap, this.tex, this.group, this.x + i, this.y + j, k, l);
	}
};
