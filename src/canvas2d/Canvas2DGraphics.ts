import { CanvasLike } from "#canvas";
import { Canvas2D, DOMMatrix, DOMPoint, createBitmap } from "#canvas";
import { FakeGraphics, FakeImage, BlendMode, FakeTransform } from "../types";
import { BitmapImage } from "../util/BitmapImage";

export class Canvas2DGraphics extends FakeGraphics {
	private readonly ctx: Canvas2D;
	private c1: string;
	private c2: string;

	constructor(canvas: CanvasLike, options = {}) {
		super(canvas);
		
		const opts = {
			premultipliedAlpha: false,
			...options,
		};

		this.ctx = canvas.getContext("2d", opts) as Canvas2D;

		this.ready = Promise.resolve();
	}

	override rotate(d: number): void {
		this.ctx.rotate(d);
	}

	override scale(hf: number, vf: number): void {
		this.ctx.scale(hf, vf);
	}

	override translate(x: number, y: number): void {
		this.ctx.translate(x, y);
	}

	override drawImage(bimg: FakeImage, x: number, y: number, w: number, h: number): void {
		const img = bimg as BitmapImage;
		this.ctx.drawImage(img.bitmap, img.x, img.y, img.w, img.h, x, y, w, h);
	}

	override getTransform(): FakeTransform {
		return this.ctx.getTransform();
	}

	override setTransform(at: FakeTransform) {
		this.ctx.setTransform(at as DOMMatrix);
	}

	override setComposite(mode: BlendMode, opa: number, glow: number) {
		switch (mode) {
			case BlendMode.DEF:
				this.ctx.globalAlpha = 1;
				this.ctx.globalCompositeOperation = "source-over";
				break;
			
			case BlendMode.TRANS:
				this.ctx.globalAlpha = opa;
				this.ctx.globalCompositeOperation = "source-over";
				break;

			case BlendMode.BLEND:
				this.ctx.globalAlpha = opa;
				switch (glow) {
					case 0:
						this.ctx.globalCompositeOperation = 'source-over';
						break;

					case 1:
						this.ctx.globalCompositeOperation = 'lighter';
						break;

					case 2:
						this.ctx.globalCompositeOperation = 'multiply';
						break;
					
					case 3:
					case -1:
						this.ctx.globalCompositeOperation = 'source-over';
						// @TODO: support more blend modes in 2D canvas?
						break;

					case -2:
						this.ctx.globalCompositeOperation = 'source-over';
						break;
				}
				break;
		}
	}

	override async buildImg(blob: Blob): Promise<FakeImage> {
		const bitmap = await createBitmap(blob);

		return new BitmapImage(bitmap);
	}

	override disposeImg(bimg: FakeImage) {
		const img = bimg as BitmapImage;
		img.bitmap.close();
	}

	override resize(width: number, height: number) {
		super.resize(width, height);
		this.setBG();
		this.drawBG();
	}

	override setBG(c1?: number[], c2?: number[]) {
		if (c1) {
			this.c1 = `rgb(${c1.join(' ')})`;
			this.c2 = `rgb(${c2!.join(' ')})`;
		}

		if (this.c1) {
			const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);

			gradient.addColorStop(0, this.c1);
			gradient.addColorStop(0.5, this.c2);
			gradient.addColorStop(1, this.c1);
	
			this.ctx.fillStyle = gradient;
		}
	}

	override drawBG() {
		const trans = this.ctx.getTransform();

		this.ctx.resetTransform();
		this.ctx.globalCompositeOperation = 'source-over';
		this.ctx.globalAlpha = 1;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.ctx.setTransform(trans);
	}

	override loadIdentity(): void {
		this.ctx.resetTransform();
	}

	override transformPoint(p: DOMPoint, x: number, y: number) {
		const t = this.ctx.getTransform().transformPoint(new DOMPoint(x, y));
		p.x = t.x;
		p.y = t.y;
	}

	override clearWindow(): void {
		const trans = this.ctx.getTransform();

		this.ctx.resetTransform();
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.ctx.setTransform(trans);
	}

	override getImageData(): Promise<Uint8ClampedArray> {
		return Promise.resolve(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data);
	}
};
