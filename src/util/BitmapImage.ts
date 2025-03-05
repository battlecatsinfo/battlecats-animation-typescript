import { Bitmap } from "#canvas";
import { FakeImage } from "../types";

export class BitmapImage implements FakeImage {
	constructor(
		public readonly bitmap: Bitmap,
		public readonly x: number = 0,
		public readonly y: number = 0,
		public readonly w: number = bitmap.width,
		public readonly h: number = bitmap.height,
	) {

	}

	getWidth(): number {
		return this.w;
	}

	getHeight(): number {
		return this.h;
	}

	getSubimage(i: number, j: number, k: number, l: number): BitmapImage {
		return new BitmapImage(this.bitmap, this.x + i, this.y + j, k, l);
	}
};
