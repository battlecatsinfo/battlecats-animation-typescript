import { CanvasLike } from "#canvas";
import { GLGraphics } from "../webgl/GLGraphics";
import { Canvas2DGraphics } from "../canvas2d/Canvas2DGraphics";
import { WebGPUGraphics } from "../webgpu/WebGPUGraphics";
import { AnimLoader } from "./AnimLoader";
import { parseHexColor, toIntFast } from "../util/util";
import { FakeGraphics } from "../types";
import { msToFrame, frameToMs } from "../config";
import { ExportGraphics } from "./ExportGraphics";
import { observe } from "../util/observer";
import { download } from "../util/download";

type CanvasContructor = { new (canvas: CanvasLike, options?: object): FakeGraphics };

const enum TouchState {
	None, Scaling, Moving
};

const engineMap: { [key: string]: CanvasContructor } = {
	'WebGL': GLGraphics,
	'Canvas2D': Canvas2DGraphics,
	'WebGPU': WebGPUGraphics,
};

const dpr = self.devicePixelRatio || 1; // may run in web workers
const minMoveInterval = dpr * 5;

export class AnimPage {
	private readonly g: FakeGraphics;
	private readonly loader: AnimLoader;
	private readonly animateLoopF: (timestamp: DOMHighResTimeStamp) => void;
	private readonly moveLoopF: (timestamp: DOMHighResTimeStamp) => void;

	private readonly canvas: HTMLCanvasElement;
	private readonly nextFrameEl: HTMLButtonElement;
	private readonly prevFrameEl: HTMLButtonElement;
	private readonly pauseEl: HTMLButtonElement;
	private readonly animTypeEl: HTMLSelectElement;
	private readonly engineEl: HTMLSelectElement;
	private readonly unitIdEl: HTMLInputElement;
	private readonly rangeEl: HTMLInputElement;
	private readonly startPlayEl: SVGSVGElement;
	private readonly exportImgEl: HTMLButtonElement;
	private readonly exportGifEl: HTMLButtonElement;
	private readonly exportGifElTransEl: HTMLButtonElement;
	private readonly exportMp4El: HTMLButtonElement;
	private readonly exportMp460El: HTMLButtonElement;
	private readonly iconsEl: HTMLDivElement;
	private readonly color1El: HTMLInputElement;
	private readonly color2El: HTMLInputElement;
	private readonly loadingEl: HTMLDivElement;
	private readonly progressCtnEl: HTMLDivElement;
	private readonly zoomEl: HTMLInputElement;
	private readonly speedEl: HTMLInputElement;

	private show_menu?: HTMLUListElement;

	private loaded = false;
	private stop = false;
	private cur_form = 0;
	private mouseDown = false;
	private moving = false;
	private dragging = false;
	private speedFactor = 1;
	private touchState = TouchState.None;

	private frame: number;
	private length: number;
	private zeroTime: number;
	private moveZeroTime: number;
	private initialX: number;
	private initialY: number;
	private targetX: number;
	private targetY: number;
	private initialDis: number;
	private siz: number;
	private initScale: number;

	constructor() {
		const url = new URL(location.href);

		const id = url.searchParams.get('id');
		let i: number;

		if (id && !Number.isNaN(i = parseInt(id, 10))) {

			const cmd = url.searchParams.get('cmd');
			if (cmd) {
				const form = parseInt(url.searchParams.get('form') || '0', 10);
				const mode = parseInt(url.searchParams.get('mode') || '0', 10);
				const engine = url.searchParams.get('engine') || 'WebGL';

				function reportWorkerError(e: any) {
					postMessage({ type: 'error', data: e });
				}

				const Cls = engineMap[engine];
				const g = new ExportGraphics(Cls, true);
				const self = this;

				this.loader = new AnimLoader(g);

				g.ready.then(function () {
					self.loader.load(i).then(() => {
						self.loader.forms[form].switchMode(mode);
						self.executeCommand({ cmd, form, instance: g }).catch(reportWorkerError);
					}).catch(reportWorkerError);
				});

				return;
			}
		} else {
			i = 0;
		}

		this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
		this.unitIdEl = document.getElementById('unitid') as HTMLInputElement;
		i && (this.unitIdEl.value = i.toString());
		this.zoomEl = document.getElementById('zoom') as HTMLInputElement;
		this.startPlayEl = (document.getElementById('start-play') as any) as SVGSVGElement;
		this.animTypeEl = document.getElementById('animtype') as HTMLSelectElement;
		this.engineEl = document.getElementById('engine') as HTMLSelectElement;
		this.nextFrameEl = document.getElementById('next') as HTMLButtonElement;
		this.prevFrameEl = document.getElementById('prev') as HTMLButtonElement;
		this.pauseEl = document.getElementById('pause') as HTMLButtonElement;
		this.rangeEl = document.getElementById('range') as HTMLInputElement;
		this.exportImgEl = document.getElementById('export-img') as HTMLButtonElement;
		this.exportGifEl = document.getElementById('export-gif') as HTMLButtonElement;
		this.exportGifElTransEl = document.getElementById('export-gif-trans') as HTMLButtonElement;
		this.exportMp4El = document.getElementById('export-mp4') as HTMLButtonElement;
		this.exportMp460El = document.getElementById('export-mp4-60') as HTMLButtonElement;
		this.iconsEl = document.getElementById('icons') as HTMLDivElement;
		this.progressCtnEl = document.getElementById('progress-container') as HTMLDivElement;
		this.loadingEl = document.getElementById('loading') as HTMLDivElement;
		this.color1El = document.getElementById('color1') as HTMLInputElement;
		this.color2El = document.getElementById('color2') as HTMLInputElement;
		this.speedEl = document.getElementById('speed') as HTMLInputElement;

		this.g = this.selectEngine();
		this.loader = new AnimLoader(this.g);
		this.animateLoopF = this.animateLoop.bind(this);
		this.moveLoopF = this.moveLoop.bind(this);
		this.addListeners();

		this.g.ready.then(() => {
			this.g.setBG([70, 140, 160], [85, 185, 205]);
			return observe(this.g, this.handleResize.bind(this));
		}).then(() => {
			this.setupSize();
			this.handleInput();
		}).catch(err => this.engineErr(err, this.engineEl.value));
	}

	private handleResize() {
		if (!this.loaded)
			return;

		this.loader.forms[this.cur_form].drawFrameNoUpdate();
	}

	private handlePause() {
		if (!this.loaded)
			return;

		if (this.stop) {
			this.stop = false;
			this.setPlayIcon();
			this.zeroTime = (document.timeline.currentTime as number) - frameToMs(this.frame / this.speedFactor);
			requestAnimationFrame(this.animateLoopF);
		} else {
			this.stop = true;
			this.setPlayIcon();
		}
	}

	private nextFrame(mod: number) {
		if (!this.loaded)
			return;

		if (this.stop) {
			this.frame = Math.round(this.frame) + mod;
			this.loader.forms[this.cur_form].drawFrame(this.frame);
			this.rangeEl.value = this.frame.toString();
		}
	}

	private addListeners() {
		const self = this;

		this.pauseEl.addEventListener('click', this.handlePause.bind(this));

		this.nextFrameEl.addEventListener('click', function () {
			self.nextFrame(1);
		});

		this.prevFrameEl.addEventListener('click', function () {
			self.nextFrame(-1);
		});

		this.rangeEl.addEventListener('input', function () {
			if (self.stop) {
				const val = parseInt(self.rangeEl.value, 10);
				if (Number.isNaN(val))
					return;

				self.loader.forms[self.cur_form].drawFrame(self.frame = val);
				self.rangeEl.value = self.frame.toString();
			}
		});

		this.animTypeEl.addEventListener('input', function () {
			if (!self.loaded)
				return;

			self.rangeEl.value = '0';
			self.startAnimate();
		});

		for (const elem of [
			this.exportImgEl,
			this.exportGifEl,
			this.exportGifElTransEl,
			this.exportMp4El,
			this.exportMp460El
		]) {
			elem.addEventListener('click', async function (event: MouseEvent) {
				self.stop = true; // save CPU usage

				const target = event.currentTarget;

				if (target === self.exportImgEl) {
					const g = new ExportGraphics(self.g.constructor as any, false);
					await g.ready;
					g.exportImg(self.loader.forms[self.cur_form], self.frame);
					return;
				}

				let cmd: string, title: string;
				if (target === self.exportGifEl) {
					cmd = 'gif';
					title = '匯出 GIF';
				} else if (target === self.exportGifElTransEl) {
					cmd = 'gif-trans';
					title = '匯出 GIF（透明）';
				} else if (target === self.exportMp4El) {
					cmd = 'mp4';
					title = '匯出 MP4';
				} else if (target === self.exportMp460El) {
					cmd = 'mp4-60';
					title = '匯出 MP4（60 FPS）';
				} else {
					console.assert(false, "Invalid target ", target);
					return;
				}

				if (window.Worker) {
					const url = new URL('anim.min.js', document.baseURI || location.href); /*import.meta.url*/
					url.searchParams.set('id', self.unitIdEl.value);
					url.searchParams.set('cmd', cmd);
					url.searchParams.set('form', self.cur_form.toString());
					url.searchParams.set('engine', self.engineEl.value);
					url.searchParams.set('mode', self.animTypeEl.selectedIndex.toString());
					console.info(`Spawn Web Worker(${url})`);
					const worker = new Worker(url, { type: "module" });
					const bar = self.createProgressBar(title);

					worker.onmessage = (e) => {
						if (e.data.type) {
							switch (e.data.type) {
								case 'error':
									console.error(e.data);
									break;

								case 'success':
									self.completeProgress(bar);
									download(e.data.blob, e.data.filename);
									setTimeout(() => {
										console.log('terminated web worker');
										worker.terminate();
									});
									break;

								case 'progress':
									self.setProgress(bar, e.data.data);
									break;

								default:
									console.log(e.data);
									break;
							}
						}
					};
				} else {
					try {
						await self.executeCommand({ cmd, form: self.cur_form, title });
					} catch (e) {
						const err = e as any;
						alert(`匯出影片時錯誤：${err.message || err}`);
					}
				}
			});
		}

		const handleColor = function () {
			self.g.setBG(parseHexColor(self.color1El.value), parseHexColor(self.color2El.value));
			if (self.stop)
				self.loader.forms[self.cur_form].drawFrameNoUpdate();
		}

		this.color1El.addEventListener('input', handleColor);
		this.color2El.addEventListener('input', handleColor);

		const handleSetting = function (event: MouseEvent) {
			event.stopPropagation();
			if (self.show_menu && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
				self.show_menu.hidden = true;
				self.show_menu = undefined;
				return;
			}
			self.show_menu = ((event.currentTarget as HTMLAnchorElement).firstElementChild as SVGSVGElement).nextElementSibling as HTMLUListElement;
			self.show_menu.hidden = false;
		};

		this.speedEl.addEventListener('input', function () {
			self.speedFactor = parseFloat(self.speedEl.value);
		});

		document.getElementById('settings')!.addEventListener('click', handleSetting);
		document.getElementById('share')!.addEventListener('click', handleSetting);

		document.getElementById('nextu')!.addEventListener('click', function (event: MouseEvent) {
			event.stopPropagation();
			const val = parseInt(self.unitIdEl.value, 10);

			if (Number.isNaN(val))
				return;

			self.unitIdEl.value = (val + 1).toString();

			self.handleInput();
		});

		document.getElementById('prevu')!.addEventListener('click', function (event: MouseEvent) {
			event.stopPropagation();
			const val = parseInt(self.unitIdEl.value, 10);

			if (Number.isNaN(val))
				return;

			self.unitIdEl.value = (val - 1).toString();

			self.handleInput();
		});

		window.addEventListener('keydown', function (event: KeyboardEvent) {
			if (event.target instanceof HTMLInputElement)
				return;

			event.stopPropagation();
			event.preventDefault();

			switch (event.key) {
				case 'p':
				case ' ':
					self.handlePause();
					break;

				case 'd':
				case 'ArrowRight':
					self.moveXY(5, 0);
					break;

				case 'a':
				case 'ArrowLeft':
					self.moveXY(-5, 0);
					break;

				case 'w':
				case 'ArrowUp':
					self.moveXY(0, -5);
					break;

				case 's':
				case 'ArrowDown':
					self.moveXY(0, 5);
					break;

				case 'n':
					self.nextFrame(1);
					break;

				case 'b':
					self.nextFrame(-1);
					break;
			}
		});

		for (let e of this.iconsEl.children) {
			(e as HTMLImageElement).onclick = function (event: MouseEvent) {
				const img = event.currentTarget as HTMLImageElement;

				self.cur_form = parseInt(img.getAttribute('data-i')!, 10);

				for (const e of self.iconsEl.children)
					e.className = e == img ? 'active' : '';

				self.startAnimate();
			}
		}

		this.canvas.addEventListener('mousedown', function (event: MouseEvent) {
			if (!self.loaded)
				return;

			self.dragging = false;
			self.moving = self.mouseDown = true;
			self.targetX = self.initialX = event.clientX;
			self.targetY = self.initialY = event.clientY;
			self.moveZeroTime = document.timeline.currentTime as number;
			self.moveLoop(self.moveZeroTime);
		});

		this.canvas.addEventListener('mouseup', function (event: MouseEvent) {
			self.mouseDown = false;
			self.targetX = event.clientX;
			self.targetY = event.clientY;
		});

		this.canvas.addEventListener('mousemove', function (event: MouseEvent) {
			event.preventDefault();
			event.stopPropagation();
			self.dragging = true;
			if (!self.loaded)
				return;

			if (self.mouseDown) {
				self.targetX = event.clientX;
				self.targetY = event.clientY;
			}
		}, { passive: false });

		/*
		 * only avaialbe in Safari
		 *
		this.canvas.addEventListener('gesturestart', function (event: GestureEvent)) {
			self.initialScale = parseInt(this.zoomEl.value, 10);
		}

		this.canvas.addEventListener('gesturechange', function (event: GestureEvent) {
			const val = Math.round(self.initialScale * event.scale);
			self.loader.setSize(self.siz = val / 100);
		});

		this.canvas.addEventListener('gestureend', function (event: GestureEvent) {
			const val = Math.round(self.initialScale * event.scale);
			self.zoomEl.value = val.toString();
			self.loader.setSize(self.siz = val / 100);
		});
		 */

		this.canvas.addEventListener('touchstart', function (event: TouchEvent) {
			event.preventDefault();
			self.dragging = false;

			if (!self.loaded)
				return;

			switch (event.touches.length) {
				case 1:
					self.touchState = TouchState.Moving;
					const { clientX, clientY } = event.changedTouches[0];
					self.initialX = self.targetX = clientX;
					self.initialY = self.targetY = clientY;
					self.moving = self.mouseDown = true;
					self.moveZeroTime = document.timeline.currentTime as number;
					self.moveLoop(self.moveZeroTime);
					break;

				case 2:
					self.touchState = TouchState.Scaling;
					self.initialDis = Math.hypot(
						event.touches[0].pageX - event.touches[1].pageX,
						event.touches[0].pageY - event.touches[1].pageY
					);
					self.initScale = parseInt(self.zoomEl.value, 10);
					break;

				default:
					self.touchState = TouchState.None;
					break;
			}
		}, { passive: false });

		this.canvas.addEventListener('touchmove', function (event: TouchEvent) {
			event.preventDefault();
			self.dragging = true;

			if (!self.loaded)
				return;

			switch (self.touchState) {
				case TouchState.Scaling:
					const dis = Math.hypot(
						event.touches[0].pageX - event.touches[1].pageX,
						event.touches[0].pageY - event.touches[1].pageY
					);
					const scale = self.initScale * dis / self.initialDis;

					self.loader.setSize(self.siz = scale / 100);
					self.zoomEl.value = Math.round(scale).toString();
					break;

				case TouchState.Moving:
					const { clientX, clientY } = event.changedTouches[0];
					self.targetX = clientX;
					self.targetY = clientY;
					self.dragging = Math.hypot(self.targetX - self.initialX, self.targetY - self.initialY) > minMoveInterval;
					break;

				default:
					break;
			}
		}, { passive: false });

		this.canvas.addEventListener('touchend', function (event: TouchEvent) {
			event.preventDefault();
			self.mouseDown = false;

			if (!self.dragging) {
				self.handlePause();
			}

			if (self.touchState === TouchState.Moving) {
				const { clientX, clientY } = event.changedTouches[0];
				self.targetX = clientX;
				self.targetY = clientY;
			}
			self.touchState = TouchState.None;
		}, { passive: false });

		this.startPlayEl.addEventListener('click', function () {
			if (self.stop) {
				self.stop = false;
				self.setPlayIcon();
				self.startAnimate();
			}
		});

		document.addEventListener('click', function () {
			self.mouseDown = false;

			if (self.show_menu) {
				self.show_menu.hidden = true;
				self.show_menu = undefined;
				return;
			}

			if (!self.loaded)
				return;

			if (self.dragging)
				return;

			self.handlePause();
		});

		window.addEventListener("wheel", function (event) {
			const ori = parseInt(self.zoomEl.value, 10);
			const siz = ori - 5 * Math.sign(event.deltaY);
			self.zoomEl.value = siz.toString();
			self.loader.setSize(self.siz = siz / 100);
			if (self.stop)
				self.loader.forms[self.cur_form].drawFrameNoUpdate();
		});

		this.unitIdEl.addEventListener('change', function () {
			if (!self.loaded)
				return;

			self.handleInput();
		});

		this.unitIdEl.addEventListener('focus', function () {
			this.select();
		});

		this.engineEl.addEventListener('input', function () {
			localStorage.setItem('engine', this.value);
			location.reload();
		});
	}

	private createProgressBar(title: string): HTMLDivElement {
		const div = document.createElement("div");
		div.classList.add('export-progress');

		const b = document.createElement("b");
		b.textContent = title;

		const bar = document.createElement("div");

		div.appendChild(b);
		div.appendChild(bar);

		this.progressCtnEl.appendChild(div);

		return bar;
	}

	private setProgress(bar: HTMLDivElement, progress: number) {
		const s = `${Math.round(progress * 100)}%`;

		bar.style.width = s;
		bar.textContent = s;
	}

	private completeProgress(bar: HTMLDivElement) {
		bar.style.background = "#28a745";
		bar.textContent = "匯出完成！";
		setTimeout(() => {
			bar.parentElement!.classList.add('completed');
			setTimeout(() => {
				bar.parentElement!.remove();
			}, 1000);
		}, 2500);
	}

	private async executeCommand(options: {
			cmd: string,
			form: number,
			instance?: ExportGraphics,
			title?: string,
		}) {
		const g = options.instance ?? new ExportGraphics(this.g.constructor as any, false);

		await g.ready;

		let blob: Blob;
		let filename: string;
		let bar: HTMLDivElement | undefined;

		const self = this;
		function onProgress(val: number) {
			if (bar)
				self.setProgress(bar, val);
			else
				postMessage({ type: 'progress', data: val });
		}

		if (options.title)
			bar = this.createProgressBar(options.title);

		switch (options.cmd) {

			case 'mp4':
			case 'mp4-60':
				blob = await g.exportMp4(this.loader.forms[options.form], onProgress, options.cmd === 'mp4-60');
				filename = 'animation.mp4';
				break;

			case 'gif':
			case 'gif-trans':
				blob = await g.exportGif(this.loader.forms[options.form], onProgress, options.cmd === 'gif-trans');
				filename = 'animation.gif';
				break;

			default:
				console.assert(false, `Unknown command: ${options.cmd}`);
				return;
		}

		if (bar) {
			this.completeProgress(bar);
			download(blob, filename);
		} else {
			postMessage({ type: 'success', blob, filename });
		}
	}

	private selectEngine() {
		let engine = localStorage.getItem('engine');

		if (engine)
			this.engineEl.value = engine;
		else
			engine = this.engineEl.value;

		const Cls = engineMap[engine] || GLGraphics;

		try {
			return new Cls(this.canvas);
		} catch (e) {
			const err = e as any;
			this.engineErr(err, engine);
			throw new Error(`Fail to initialize ${engine}`, { cause: err });
		}
	}

	private engineErr(error: any, engine: string) {
		alert(`您的瀏覽器不支援 ${engine}，請選擇其他渲染方式。\n\n詳細錯誤資訊：` + (error.message || error).toString());
	}

	private moveXY(x: number, y: number) {
		this.g.translate(x, y);

		if (this.stop)
			this.loader.forms[this.cur_form].drawFrameNoUpdate();
	}

	private setPlayIcon() {
		const pause_icon = this.pauseEl.firstElementChild as SVGSVGElement;
		const play_icon = pause_icon.nextElementSibling as SVGSVGElement;
		if (this.stop) {
			play_icon.setAttribute('visibility', 'visible');
			pause_icon.setAttribute('visibility', 'hidden');
			this.startPlayEl.setAttribute('visibility', 'visible');
		} else {
			play_icon.setAttribute('visibility', 'hidden');
			pause_icon.setAttribute('visibility', 'visible');
			this.startPlayEl.setAttribute('visibility', 'hidden');
		}
	}

	private handleInput() {
		const v = parseInt(this.unitIdEl.value, 10);
		if (Number.isNaN(v))
			return;

		this.loaded = false;
		this.loader.load(v).then(() => {
			let nForms = this.loader.forms.length;

			if (v >= 0) {
				let i = 0;
				for (const e of this.iconsEl.children) {
					const img = e as HTMLImageElement;
					if (i < nForms) {
						img.hidden = false;
						img.src = `/img/u/${v}/${i}.png`;
					} else {
						img.hidden = true;
					}
					img.className = i ? '' : 'active';

					++i;
				}
			} else {
				for (const e of this.iconsEl.children) {
					const img = e as HTMLImageElement;
					img.hidden = true;
				}
			}

			this.loader.setSize(this.siz);
			this.rangeEl.value = '0';
			this.loadingEl.hidden = true;
			this.loaded = true;
			this.startAnimate();
		}).catch(err => {
			alert("無法載入動畫資源：\n" + (err.message || err).toString());
		});

		this.stop = true;
		this.loadingEl.hidden = false;

		const url = new URL(location.href);
		url.searchParams.set('id', v.toString());
		if (url.href != location.href)
			history.pushState({}, '', url);
	}

	private setupSize() {
		const min = Math.min(this.canvas.clientWidth * dpr, this.canvas.clientHeight * dpr);
		const initzoomEl = Math.min(1, Math.max(0.5, min / 500));

		this.siz = initzoomEl;
		this.zoomEl.value = Math.round(initzoomEl * 100).toString();
		this.zoomEl.addEventListener('change', this.handleZoomEl.bind(this));
	}

	private handleZoomEl() {
		if (!this.loaded)
			return;

		this.loader.setSize(this.siz = parseInt(this.zoomEl.value, 10) / 100);
		if (this.stop)
			this.loader.forms[this.cur_form].drawFrameNoUpdate();
	}

	private startAnimate() {
		const F = this.loader.forms[this.cur_form];

		if (!F) return;

		this.stop = false;
		this.setPlayIcon();

		F.switchMode(this.animTypeEl.selectedIndex);

		this.length = F.length();

		this.rangeEl.max = this.length.toString();
		this.rangeEl.disabled = this.length === 1;

		F.drawFrame(0);

		this.zeroTime = document.timeline.currentTime as number;

		requestAnimationFrame(this.animateLoopF);
	}

	private move(elapsed: number) {
		const offsetX = this.targetX - this.initialX;
		const offsetY = this.targetY - this.initialY;

		if (Math.abs(offsetX) > 0.2 && Math.abs(offsetY) > 0.2) {
			const sx = offsetX * elapsed / 160;
			const sy = offsetY * elapsed / 160;
			this.g.translate(sx * dpr, sy * dpr);
			this.initialX += sx;
			this.initialY += sy;
		} else {
			this.moving = this.mouseDown;
		}
	}

	private moveLoop(timestamp: DOMHighResTimeStamp) {
		if (this.stop) {
			requestAnimationFrame(this.moveLoopF);

			if (this.moving) {
				this.move(timestamp - this.moveZeroTime);
				this.moveZeroTime = timestamp;
			}
	
			this.loader.forms[this.cur_form].drawFrameNoUpdate();
		}
	}

	private animateLoop(timestamp: DOMHighResTimeStamp) {
		if (this.stop)
			return;

		requestAnimationFrame(this.animateLoopF);

		if (this.moving) {
			this.move(timestamp - this.moveZeroTime);
			this.moveZeroTime = timestamp;
		}

		this.frame = msToFrame(this.speedFactor * (timestamp - this.zeroTime));
		this.loader.forms[this.cur_form].drawFrame(this.frame);
		this.rangeEl.value = toIntFast(this.frame).toString();
	}
};
