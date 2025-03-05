export class P {

	constructor(public x = 0, public y = 0) {

	}

	static polar(r: number, t: number): P {
		return new P(r * Math.cos(t), r * Math.sin(t));
	}

	static reg(cx: number): number {
		return Math.max(0, Math.min(1, cx));
	}

	clone(): P {
		return new P(this.x, this.y);
	}

	setTo(x: number, y: number): this {
		this.x = x;
		this.y = y;
		return this;
	}

	abs(): number {
		return this.dis(new P(0, 0));
	}

	atan2(): number {
		return Math.atan2(this.y, this.x);
	}

	atan2WithP(p: P): number {
		return this.sf(p).atan2();
	}

	crossP(p: P): number {
		return this.x * p.y - this.y * p.x;
	}

	dis(p: P): number {
		return Math.hypot(p.x - this.x, p.y - this.y);
	}

	divide(p: P): this {
		this.x /= p.x;
		this.y /= p.y;
		return this;
	}

	dotP(p: P): number {
		return this.x * p.x + this.y * p.y;
	}

	equals(obj: any): boolean {
		if (obj instanceof P) {
			return Math.abs(obj.x - this.x) + Math.abs(obj.y - this.y) < 1e-10;
		}
		return false;
	}

	limit(b2: P): boolean {
		return this.limitBounds(new P(0, 0), b2);
	}

	limitBounds(b1: P, b2: P): boolean {
		const out = this.out(b1, b2, 0);
		this.x = Math.max(b1.x, Math.min(b2.x, this.x));
		this.y = Math.max(b1.y, Math.min(b2.y, this.y));
		return out;
	}

	middle(p: P, per: number): P {
		return this.clone().plus(this.sf(p), per);
	}

	middleC(p: P, per: number): P {
		return this.clone().plus(this.sf(p), (1 - Math.cos(Math.PI * per)) / 2);
	}

	out(b1: P, b2: P, r: number): boolean {
		return this.x + r < b1.x || this.y + r < b1.y || this.x - r > b2.x || this.y - r > b2.y;
	}

	plus(px: number, py: number): this;
	plus(p: P, n?: number): this;
	plus(arg1: number | P, arg2?: number): this {
		if (typeof arg1 === "number" && typeof arg2 === "number") {
			this.x += arg1;
			this.y += arg2;
		} else if (arg1 instanceof P) {
			this.x += arg1.x * (arg2 ?? 1);
			this.y += arg1.y * (arg2 ?? 1);
		}
		return this;
	}

	positivize(): this {
		this.x = Math.abs(this.x);
		this.y = Math.abs(this.y);
		return this;
	}

	rotate(t: number): this {
		const newX = this.x * Math.cos(t) - this.y * Math.sin(t);
		const newY = this.y * Math.cos(t) + this.x * Math.sin(t);

		return this.setTo(newX, newY);
	}

	sf(p: P): P {
		return this.substractFrom(p);
	}

	substractFrom(p: P): P {
		return new P(p.x - this.x, p.y - this.y);
	}

	timesP(p: P): this {
		this.x *= p.x;
		this.y *= p.y;
		return this;
	}

	times2(hf: number, vf: number): this {
		this.x *= hf;
		this.y *= vf;
		return this;
	}

	times(d: number): this {
		this.x *= d;
		this.y *= d;
		return this;
	}
};
