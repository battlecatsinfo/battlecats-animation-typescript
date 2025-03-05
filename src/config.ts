export const fullOpa = 90; // If opacity above fullOpa, the image will draw will full opacity(100%).
export const deadOpa = 10; // If opacity belows deadOpa, the image will not be drawn.
export const centerXRatio = 1 / 2;
export const centerYRatio = 2 / 3;
export const BC_FPS = 30; // About 30 frames = 1 seconds in BC.

export function opaDead(opa: number): boolean {
	return opa < deadOpa * 0.01 + 1e-5;
}

export function opaNotFull(opa: number): boolean {
	return opa < fullOpa * 0.01 - 1e-5;
}

export function centerX(width: number): number {
	return width * centerXRatio;
}

export function centerY(height: number): number {
	return height * centerYRatio;
}

export function msToFrame(ms: number) {
	return ms * BC_FPS / 1000;
}

export function frameToMs(frame: number) {
	return frame * 1000 / BC_FPS;
}
