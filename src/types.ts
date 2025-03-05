import { centerX, centerY } from "./config";
import { DOMPoint, CanvasLike } from "#canvas";

export abstract class LineStream {
	/**
	 * Try to read line from stream. Return null if reachs end of file.
	 */
	abstract tryReadLine(): string | null;

	/**
	 * Read line from string, throws error if reachs end of file.
	 * @returns line
	 */
	readLine(): string {
		const line = this.tryReadLine();

		if (line === null)
			throw new Error("No more lines to read!");

		return line;
	}

	/**
	 * Skip a line in stream, throws error if reachs end of file.
	 */
	skipLine(): void {
		this.readLine();
	}
}

/**
 * Modification type used in BC animations.
 */
export const enum ModificationType {
	PARENT,
	ID,
	SPRITE,
	Z_ORDER,
	POS_X,
	POS_Y,
	PIVOT_X,
	PIVOT_Y,
	SCALE,
	SCALE_X,
	SCALE_Y,
	ANGLE,
	OPACITY,
	HORIZONTAL_FLIP,
	VERTICAL_FLIP,

	EXTENT_X = 50,
	EXTENT_X2 = 51,
	EXTENT_Y = 52,
	SCALE_MULT = 53
};

export const enum EaseType {
	LINEAR,
	INSTANT,
	EXPONENTIAL,
	POLYNOMIAL,
	SINUSOIDAL
};

/**
 * 2D Transform matrix. See util/Affine2D.ts.
 */
export interface FakeTransform {
	/* nothing here! */
};

/**
 * Images used by FakeGraphics's drawImage().
 */
export interface FakeImage {

	getWidth(): number;

	getHeight(): number;

	getSubimage(i: number, j: number, k: number, l: number): FakeImage;
};

export const enum BlendMode {
	None, DEF, TRANS, BLEND
};

/* The graphics driver */
export abstract class FakeGraphics {
	public ready: Promise<void>;

	constructor(public canvas: CanvasLike) {

	}

	abstract setComposite(mode: BlendMode, opa: number, glow: number): void;

	abstract drawImage(bimg: FakeImage, x: number, y: number, w: number, h: number): void;

	abstract getTransform(): FakeTransform;

	abstract setTransform(at: FakeTransform): void;

	abstract loadIdentity(): void;

	abstract rotate(d: number): void;

	abstract scale(hf: number, vf: number): void;

	abstract translate(x: number, y: number): void;

	abstract transformPoint(p: DOMPoint, x: number, y: number): void;

	/**
	 * Create a FakeImage for rendering(drawImage()).
	 */
	abstract buildImg(blob: Blob): Promise<FakeImage>;

	/**
	 * Close all resouces used for FakeImage.
	 */
	abstract disposeImg(img: FakeImage): void;

	abstract setBG(c1: number[], c2: number[]): void;

	abstract drawBG(): void;

	abstract clearWindow(): void;

	/**
	 * Return RGBA data of canvas (length = 4 * width * height).
	 */
	abstract getImageData(): Promise<Uint8ClampedArray>;
	
	/**
	 * Resize the canvas and fill background
	 * @param width Integer of the new width
	 * @param height integer of the new height
	 */
	resize(width: number, height: number) {
		this.canvas.width = width;
		this.canvas.height = height;
	}

	/**
	 * Return the width of canvas.
	 */
	getWidth(): number {
		return this.canvas.width;
	}

	/**
	 * Return the height of canvas.
	 */
	getHeight(): number {
		return this.canvas.height;
	}

	/**
	 * Translate to center of canvas.
	 */
	translateCenter() {
		this.loadIdentity();
		this.translate(centerX(this.getWidth()), centerY(this.getHeight()));
	}
};
