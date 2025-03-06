export function checkOffscreenCanvas() {
	if (typeof self.OffscreenCanvas !== 'function' || typeof self.OffscreenCanvas.prototype.convertToBlob !== 'function') {
		// @ts-ignore
		self.OffscreenCanvas = (class {
			canvas: HTMLCanvasElement;

			constructor(width: number, height: number) {
				this.canvas = document.createElement('canvas');
				this.canvas.width = width;
				this.canvas.height = height;
			}

			getContext(contextType: string, contextAttributes?: object) {
				return this.canvas.getContext(contextType, contextAttributes);
			}

			convertToBlob(options?: { type?: string, quality?: number }) {
				return new Promise((resolve, reject) => {
					this.canvas.toBlob(blob => blob ? resolve(blob) : reject(blob), options?.type, options?.quality);
				});
			}

			get width() {
				return this.canvas.width;
			}

			get height() {
				return this.canvas.height;
			}

			set width(v: number) {
				this.canvas.width = v;
			}

			set height(v: number) {
				this.canvas.height = v;
			}
		});
	}
};
