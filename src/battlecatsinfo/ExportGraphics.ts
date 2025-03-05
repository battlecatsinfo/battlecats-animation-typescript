import { CanvasLike } from "#canvas";
import { BlendMode, FakeGraphics, FakeImage, FakeTransform } from "../types";
import { AnimUnit } from "../AnimUnit";
import { BC_FPS } from "../config";
import { BitmapImage } from "../util/BitmapImage";
import { GLImage } from "../webgl/GLImage";
import { GLGraphics } from "../webgl/GLGraphics";
import { GPUImage } from "../webgpu/GPUImage";
import { WebGPUGraphics } from "../webgpu/WebGPUGraphics";
import { toIntFast } from "../util/util";
import { download } from "../util/download";

import loadMP4Module, { isWebCodecsSupported } from "mp4-wasm";
import * as mp4Muxer from 'mp4-muxer';
import * as gifenc from "gifenc";
import * as HME from "h264-mp4-encoder";

const padding = 10;
const minWidth = 100;
const minHeight = 100;

export class ExportGraphics extends FakeGraphics {
	private drawing = false;
	private leftBound = Infinity;
	private rightBound = -Infinity;
	private bottomBuond = -Infinity;
	private topBound = Infinity;
	private driver: FakeGraphics;
	private readonly inWebWorker: boolean;

	constructor(Cls: new (canvas: CanvasLike, options?: object) => FakeGraphics, inWebWorker: boolean) {
		const canvas = new OffscreenCanvas(1, 1);
		super(canvas);
		this.driver = new Cls(canvas, { willReadFrequently: true });
		this.ready = this.driver.ready;
		this.inWebWorker = inWebWorker;
	}

	prepareForDraw() {
		if (!(
			Number.isFinite(this.leftBound) &&
			Number.isFinite(this.topBound) &&
			Number.isFinite(this.rightBound) &&
			Number.isFinite(this.bottomBuond)
		))
			throw new Error("Fail to get animation border.");

		this.drawing = true;
		this.leftBound = this.leftBound - padding;
		this.rightBound = this.rightBound + padding;
		this.topBound = this.topBound - padding;
		this.bottomBuond = this.bottomBuond + padding;

		let width = Math.max(Math.ceil(this.rightBound - this.leftBound), minWidth);
		let height = Math.max(Math.ceil(this.bottomBuond - this.topBound), minHeight);

		if (width & 1)
			++width;

		if (height & 1)
			++height;
		
		this.driver.resize(width, height);
		this.driver.translate(-this.leftBound, -this.topBound);
	}

	override setComposite(mode: BlendMode, opa: number, glow: number) {
		if (this.drawing)
			return this.driver.setComposite(mode, opa, glow);
	}

	override drawImage(bimg: FakeImage, x: number, y: number, w: number, h: number) {
		if (!this.drawing) {
			const p1 = new DOMPoint();
			const p2 = new DOMPoint();
			this.transformPoint(p1, x, y);
			this.transformPoint(p2, x + w, y + h);

			this.leftBound = Math.min(p1.x, p2.x, this.leftBound);
			this.rightBound = Math.max(p1.x, p2.x, this.rightBound);
			this.topBound = Math.min(p1.y, p2.y, this.topBound);
			this.bottomBuond = Math.max(p2.y, p2.y, this.bottomBuond);
			return;
		}

		return this.driver.drawImage(bimg, x, y, w, h);
	}

	override setBG() {

	}

	override drawBG() {
		if (this.drawing)
			this.driver.clearWindow();
	}

	override getTransform(): FakeTransform {
		return this.driver.getTransform();
	}

	override setTransform(at: FakeTransform): void {
		return this.driver.setTransform(at);
	}

	override loadIdentity(): void {
		return this.driver.loadIdentity();
	}

	override rotate(d: number): void {
		return this.driver.rotate(d);
	}

	override scale(hf: number, vf: number): void {
		return this.driver.scale(hf, vf);
	}

	override translate(x: number, y: number): void {
		return this.driver.translate(x, y);
	}

	override transformPoint(p: DOMPoint, x: number, y: number) {
		return this.driver.transformPoint(p, x, y);
	}

	override buildImg(blob: Blob): Promise<FakeImage> {
		return this.driver.buildImg(blob);
	}

	override disposeImg(img: FakeImage): void {
		return this.driver.disposeImg(img);
	}

	override clearWindow(): void {
		return this.driver.clearWindow();
	}

	override getImageData(): Promise<Uint8ClampedArray> {
		return this.driver.getImageData();
	}

	exportImg(unit: AnimUnit, frame: number) {
		const u = this.copyUnit(unit);
		u.drawFrame(frame);
		this.prepareForDraw();
		u.drawFrame(frame);
		(this.driver.canvas as OffscreenCanvas).convertToBlob({ type: 'image/png', quality: 1 }).then(function (blob) {
			download(blob, `frame ${toIntFast(frame)}.png`);
		});
	}

	private extractImgData(img: HTMLImageElement | ImageBitmap): Uint8ClampedArray {
		const canvas = new OffscreenCanvas(img.width, img.height);
		const ctx = canvas.getContext('2d')!;

		ctx.drawImage(img, 0, 0);
		return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	}

	// Encoding using gifenc
	// @TODO: scale to smaller size to improve performance and file size?
	async exportGif(unit: AnimUnit, onProgress: (val: number) => void, transparent: boolean) {
		const flipY = this.driver instanceof GLGraphics;

		if (flipY)
			this.driver.scale(1, -1);

		const u = this.copyUnit(unit);
		const delay = toIntFast(1000 / BC_FPS);
		const length = u.length();

		for (let f = 0;f <= length;++f) 
			u.drawFrame(f);
		
		if (flipY)
			this.driver.loadIdentity();
		this.prepareForDraw();
		if (flipY)
			this.driver.scale(1, -1);

		const width = this.driver.canvas.width;
		const height = this.driver.canvas.height;

		let RGBA: Uint8ClampedArray;
		if (u.cutImg instanceof BitmapImage) {
			RGBA = this.extractImgData(u.cutImg.bitmap);
		} else {
			throw "Failed to extract RGBA data from image.";
		}
		const palette = gifenc.quantize(RGBA, 256);
	
		const gif = new gifenc.GIFEncoder();

		for (let f = 0;f <= length;++f) {
			u.drawFrame(f);
			const data = await this.driver.getImageData();
			const index = gifenc.applyPalette(data, palette);
			gif.writeFrame(index, width, height, { palette, delay, transparent });
			onProgress((f + 1) / length);
		}

		gif.finish();

		return new Blob([ gif.bytes() ], { type: 'image/gif' });
	}

	getPreferredCodecs(is60fps: boolean) {
		return [
			is60fps ? 'avc1.4D4032' : 'avc1.4D4028', // Main Profile Level 4.0 / 4.2
			is60fps ? 'avc1.4D4034' : 'avc1.4D4033', // Main Profile Level 5.1 / 5.2
			is60fps ? 'avc1.640034' : 'avc1.640033', // High Profile Level 5.1 / 5.2
		];
	}

	exportMp4(unit: AnimUnit, onProgress: (val: number) => void, is60fps = false) {
		if (isWebCodecsSupported()) {
			/*
			 * mp4-muxer dose not work well in Firefox right now.
			 *
			if (navigator.userAgent.toLowerCase().includes('firefox')) {
				console.info('encoding using mp4-wasm');
				return this.exportMp4Wasm(unit, onProgress, is60fps);
			}
			console.info('encoding using mp4-muxer');
			return this.exportMp4Muxer(unit, onProgress, is60fps);
			 *
			 */

			console.info('encoding using mp4-wasm');
			return this.exportMp4Wasm(unit, onProgress, is60fps);
		} else {
			console.info('encoding using h264-mp4-encoder');
			return this.exportMp4H264Encoder(unit, onProgress, is60fps);
		}
	}

	async exportMp4H264Encoder(unit: AnimUnit, onProgress: (val: number) => void, is60fps = false) {
		const flipY = this.driver instanceof GLGraphics;

		if (flipY)
			this.driver.scale(1, -1);
		
		const u = this.copyUnit(unit);

		const length = u.length();
		for (let f = 0;f <= length;++f)
			u.drawFrame(f);
		
		if (flipY)
			this.driver.loadIdentity();
		this.prepareForDraw();
		if (flipY)
			this.driver.scale(1, -1);

		const width = this.driver.canvas.width;
		const height = this.driver.canvas.height;

		const fps = is60fps ? 60 : 30;
		const bpp = 0.1; // Adjust based on quality needs
		const bitrate = Math.min(width * height * fps * bpp, 20e6);
		const inc = is60fps ? 0.5 : 1;

		const encoder = await HME.createH264MP4Encoder();
		
		encoder.width = width;
		encoder.height = height;
		encoder.frameRate = fps;
		encoder.kbps = bitrate / 1000;
		// encoder.speed = 0;
		// encoder.quantizationParameter = 33;

		encoder.initialize();

		for (let f = 0;f <= length; f += inc) {
			u.drawFrame(f);
			encoder.addFrameRgba(await this.driver.getImageData());
			onProgress((f + 1) / length);
		}

		encoder.finalize();

		const blob = new Blob([ encoder.FS.readFile(encoder.outputFilename) ], { type: 'video/mp4' });

		encoder.delete();

		return blob;
	}

	// Encoding using mp4-wasm
	async exportMp4Wasm(unit: AnimUnit, onProgress: (val: number) => void, is60fps = false) {
		const u = this.copyUnit(unit);

		const length = u.length();
		for (let f = 0;f <= length;++f)
			u.drawFrame(f);
		
		this.prepareForDraw();

		const width = this.driver.canvas.width;
		const height = this.driver.canvas.height;

		const fps = is60fps ? 60 : 30;
		const bpp = 0.1; // Adjust based on quality needs
		const bitrate = Math.min(width * height * fps * bpp, 20e6);
		const inc = is60fps ? 0.5 : 1;

		const config: VideoEncoderConfig = {
			codec: '',
			width,
			height,
			bitrate,
		};

		const preferredCodecs = this.getPreferredCodecs(is60fps);

		let codec: string | undefined;

		for (const c of preferredCodecs) {
			config.codec = c;
			const status = await VideoEncoder.isConfigSupported(config);
			if (status.supported) {
				const newConfig = status.config ?? config;
				codec = newConfig.codec;
				console.info('Encoding with config: ', newConfig);
				break;
			}
		}

		if (!codec)
			throw "No supported codec found for VideoEncoder!";

		const MP4 = await loadMP4Module();
		const encoder = MP4.createWebCodecsEncoder({
			width,
			height,
			fps,
			bitrate,
			codec,
			encoderOptions: {
				framerate: fps,
				bitrate,
			}
		});

		for (let f = 0;f <= length; f += inc) {
			u.drawFrame(f);
			const bitmap = await createImageBitmap(this.driver.canvas);
			await encoder.addFrame(bitmap);
			onProgress((f + 1) / length);
		}

		return new Blob([ await encoder.end() ], { type: 'video/mp4' });
	}

	// Encoding using mp4-muxer
	async exportMp4Muxer(unit: AnimUnit, onProgress: (val: number) => void, is60fps = false) {
		const u = this.copyUnit(unit);

		const length = u.length();
		for (let f = 0;f <= length;++f)
			u.drawFrame(f);
		
		this.prepareForDraw();

		const width = this.driver.canvas.width;
		const height = this.driver.canvas.height;

		const frameRate = is60fps ? 60 : 30;
		const bpp = 0.1; // Adjust based on quality needs
		const bitrate = Math.min(width * height * frameRate * bpp, 20e6);
		const inc = is60fps ? 0.5 : 1;

		const muxer = new mp4Muxer.Muxer({
			target: new mp4Muxer.ArrayBufferTarget(),
			video: {
				codec: 'avc',
				width,
				height,
				frameRate,
			},
			fastStart: false,
			firstTimestampBehavior: 'strict',
		});

		const videoEncoder = new VideoEncoder({
			output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
			error: e => console.error(e)
		});

		const config: VideoEncoderConfig = {
			codec: '',
			width,
			height,
			bitrate,
		};

		const preferredCodecs = this.getPreferredCodecs(is60fps);

		let configured = false;

		for (const codec of preferredCodecs) {
			config.codec = codec;
			const status = await VideoEncoder.isConfigSupported(config);
			if (status.supported) {
				const newConfig = status.config ?? config;
				videoEncoder.configure(newConfig);
				configured = true;
				console.info('Encoding with config: ', newConfig);
				break;
			}
		}

		if (!configured)
			throw "No supported codec found for VideoEncoder!";

		const keyFrameInterval = frameRate * 2;
		const timestampMul = 1e6 / BC_FPS;

		for (let f = 0;f <= length; f += inc) {
			u.drawFrame(f);
			const timestamp = f * timestampMul;
			const frame = new VideoFrame(this.driver.canvas, { timestamp });
			videoEncoder.encode(frame, { keyFrame: (f % keyFrameInterval) === 0 });
			frame.close();
			onProgress((f + 1) / length);
		}

		await videoEncoder.flush();
		muxer.finalize();

		const blob = new Blob([ muxer.target.buffer ], { type: 'video/mp4' });

		videoEncoder.close();

		return blob;
	}

	copyUnit(unit: AnimUnit): AnimUnit {
		if (this.inWebWorker)
			return unit;

		let u: AnimUnit;
		if (this.driver instanceof GLGraphics) {
			const img = this.driver.buildImgFromBitmap((unit.cutImg as GLImage).bitmap);
			u = new AnimUnit(this, unit.cut, img, unit.model, unit.anims);
		} else if (this.driver instanceof WebGPUGraphics) {
			const img = this.driver.buildImgFromBitmap((unit.cutImg as GPUImage).bitmap);
			u = new AnimUnit(this, unit.cut, img, unit.model, unit.anims);
		} else {
			u = new AnimUnit(this, unit.cut, unit.cutImg, unit.model, unit.anims);;
		}

		u.switchMode(unit.currentMode());
		u.setValue();

		return u;
	}
};
