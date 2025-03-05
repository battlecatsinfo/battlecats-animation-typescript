import { FakeGraphics } from "../types";

let resolved = false;

export function observe(g: FakeGraphics, callback: () => void): Promise<void> {
	return new Promise(resolve => {
		const observer = new ResizeObserver(function (entries: ResizeObserverEntry[]) {
			for (const entry of entries) {
				let width;
				let height;
				let dpr = window.devicePixelRatio;

				if (entry.devicePixelContentBoxSize) {
					width = entry.devicePixelContentBoxSize[0].inlineSize;
					height = entry.devicePixelContentBoxSize[0].blockSize;
					dpr = 1;
				} else if (entry.contentBoxSize) {
					if (entry.contentBoxSize[0]) {
						width = entry.contentBoxSize[0].inlineSize;
						height = entry.contentBoxSize[0].blockSize;
					} else {
						width = (entry.contentBoxSize as unknown as ResizeObserverSize).inlineSize;
						height = (entry.contentBoxSize as unknown as ResizeObserverSize).blockSize;
					}
				} else {
					width = entry.contentRect.width;
					height = entry.contentRect.height;
				}

				g.resize(Math.round(width * dpr), Math.round(height * dpr));
				g.translateCenter();

				if (resolved) {
					callback();
				} else {
					resolve();
					resolved = true;
				}
			}
		});

		try {
			observer.observe(g.canvas as HTMLCanvasElement, { box: 'device-pixel-content-box' });
		} catch (e) {
			observer.observe(g.canvas as HTMLCanvasElement, { box: 'content-box' });
		}
	});
}
