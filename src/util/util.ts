export function toInt(x: number) {
	return Math.floor(x);
}

export function toIntFast(x: number) {
	return ~~x;
}

export function readInt(s: string | null | undefined): number {
	if (!s)
		return 0;

	const n = parseInt(s.trim(), 10);
	return Number.isNaN(n) ? 0 : n;
}

export function orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array {
	const out = new Float32Array(16);
	const lr = 1 / (left - right);
	const bt = 1 / (bottom - top);
	const nf = 1 / (near - far);
	out[0] = -2 * lr;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = -2 * bt;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[10] = 2 * nf;
	out[11] = 0;
	out[12] = (left + right) * lr;
	out[13] = (top + bottom) * bt;
	out[14] = (far + near) * nf;
	out[15] = 1;
	return out;
};

export function isPowerOf2(value: number) {
	return (value & (value - 1)) === 0;
}

export function parseHexColor(hex: string) {
	return [
		parseInt(hex.substring(1,3), 16),
		parseInt(hex.substring(3,5), 16),
		parseInt(hex.substring(5,7), 16),
	];
}
