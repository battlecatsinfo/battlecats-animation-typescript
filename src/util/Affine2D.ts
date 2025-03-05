import { CanvasLike } from "#canvas";
import { FakeGraphics, FakeTransform } from "../types";

export abstract class Affine2D extends FakeGraphics {
	private trans: Float32Array;

	constructor(canvas: CanvasLike) {
		super(canvas);
		this.loadIdentity();
	}

	override loadIdentity() {
		this.trans = new Float32Array([1, 0, 0, 0, 1, 0]);
	}

	override getTransform(): FakeTransform {
		return this.trans.slice();
	}

	override setTransform(at: FakeTransform) {
		this.trans = at as Float32Array;
	}

	override transformPoint(p: DOMPoint, x: number, y: number) {
		p.x = this.trans[0] * x + this.trans[1] * y + this.trans[2];
		p.y = this.trans[3] * x + this.trans[4] * y + this.trans[5];
	}

	override translate(x: number, y: number): void {
		this.trans[2] += this.trans[0] * x + this.trans[1] * y;
		this.trans[5] += this.trans[3] * x + this.trans[4] * y;
	}

	override rotate(d: number): void {
		const c = Math.cos(d);
		const s = Math.sin(d);
		const f0 = this.trans[0] * c + this.trans[1] * s;
		const f1 = this.trans[0] * -s + this.trans[1] * c;
		const f3 = this.trans[3] * c + this.trans[4] * s;
		const f4 = this.trans[3] * -s + this.trans[4] * c;
		this.trans[0] = f0;
		this.trans[1] = f1;
		this.trans[3] = f3;
		this.trans[4] = f4;
	}

	override scale(hf: number, vf: number): void {
		this.trans[0] *= hf;
		this.trans[3] *= hf;
		this.trans[1] *= vf;
		this.trans[4] *= vf;
	}
};
