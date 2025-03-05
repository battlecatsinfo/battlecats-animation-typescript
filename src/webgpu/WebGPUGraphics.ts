import { CanvasLike } from "#canvas";
import { BlendMode, FakeImage } from "../types";
import { Affine2D } from "../util/Affine2D";
import { GPUImage } from "./GPUImage";
import shaderSource from "./shaders/default.wgsl";
import { orthographic } from "../util/util";

const blendStates: (GPUBlendState | undefined)[] = [
	// #0: no blending
	undefined,
	// #1: one, one-minus-src-alpha
	{
		color: {
			srcFactor: 'one',
			dstFactor: 'one-minus-src-alpha',
		},
		alpha: {
			srcFactor: 'one',
			dstFactor: 'one-minus-src-alpha',
		}
	},
	// #2: one, one
	{
		color: {
			srcFactor: 'one',
			dstFactor: 'one',
		},
		alpha: {
			srcFactor: 'one',
			dstFactor: 'one',
		}
	},
	// #3: zero, src-color
	{
		color: {
			srcFactor: 'zero',
			dstFactor: 'src',
		},
		alpha: {
			srcFactor: 'zero',
			dstFactor: 'src',
		}
	},
	// #4: one-minus-dst-color, one
	{
		color: {
			srcFactor: 'one-minus-dst',
			dstFactor: 'one',
		},
		alpha: {
			srcFactor: 'one-minus-dst',
			dstFactor: 'one',
		}
	},
	// #5: one, one (reverse-subtract)
	{
		color: {
			operation: 'reverse-subtract',
			srcFactor: 'one',
			dstFactor: 'one',
		},
		alpha: {
			operation: 'reverse-subtract',
			srcFactor: 'one',
			dstFactor: 'one',
		}
	},
	// #6: src-alpha, one-minus-src-alpha
	{
		color: {
			srcFactor: 'src-alpha',
			dstFactor: 'one-minus-src-alpha',
		},
		alpha: {
			srcFactor: 'src-alpha',
			dstFactor: 'one-minus-src-alpha',
		}
	}
];

export class WebGPUGraphics extends Affine2D {
	private device: GPUDevice;
	private context: GPUCanvasContext;

	private imgArr = new Float32Array((2 + 2) * 4);
	private bgArr = new Float32Array((2 + 2) * 4);
	private uniformsArr = new Float32Array(1 + 3 + 1 + 3);
	private uniformsArrView: DataView;

	private imgBuffer: GPUBuffer;
	private bgBuffer: GPUBuffer;
	private uHeightBuffer: GPUBuffer;
	private uUniformsBuffer: GPUBuffer;
	private uMatBuffer: GPUBuffer;

	private shaderModule: GPUShaderModule;
	private bindGroup0: GPUBindGroup;
	private bindGroup1: GPUBindGroup;
	private bindGroupLayout1: GPUBindGroupLayout;
	private pipelineLayout: GPUPipelineLayout;
	private pipelines: GPURenderPipeline[];
	private imgPipeline: GPURenderPipeline;

	private sampler: GPUSampler;
	private dummyTexture: GPUTexture;

	private presentationFormat: GPUTextureFormat;
	private isLittleEndian: boolean;

	private oldMode = -1;
	private oldOpa = -1;

	constructor(canvas: CanvasLike, options = {}) {
		super(canvas);
		this.ready = this.init(options);
	}

	async init(options = {}) {
		const gpu = navigator.gpu;
		const adapter = await gpu?.requestAdapter();
		const device = await adapter?.requestDevice();

		if (!device) throw new Error("Failed to get GPU adapter.");

		device.lost.then((reason) => {
			alert(`WebGPU context lost ("${reason.reason}"):\n${reason.message}`);
		});

		device.onuncapturederror = (ev) => {
			alert(`WebGPU error:\n${ev.error.message}`);
		};

		this.device = device;
		this.context = this.canvas.getContext("webgpu") as GPUCanvasContext;
		this.presentationFormat = gpu.getPreferredCanvasFormat();
		this.context.configure({
			device: this.device,
			format: this.presentationFormat,
			alphaMode: 'premultiplied',
			...options
		});

		this.shaderModule = this.device.createShaderModule({ label: 'default.wgsl', code: shaderSource });

		this.dummyTexture = this.device.createTexture({
			label: 'dummy texture',
			size: [1, 1],
			format: 'rgba8unorm',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
		});

		this.uUniformsBuffer = this.device.createBuffer({
			label: 'u_uniforms buffer',
			size: this.uniformsArr.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.uHeightBuffer = this.device.createBuffer({
			label: 'u_height buffer',
			size: Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.uMatBuffer = this.device.createBuffer({
			label: 'u_mat buffer',
			size: Float32Array.BYTES_PER_ELEMENT * 16, // 4x4 matrix
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.bgBuffer = this.device.createBuffer({
			label: 'position buffer',
			size: this.bgArr.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
		});

		this.imgBuffer = this.device.createBuffer({
			label: 'texCoord buffer',
			size: this.imgArr.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
		});

		this.sampler = this.device.createSampler({
			label: 'main sampler',
			magFilter: "linear",
			minFilter: "linear"
		});

		const bindGroupLayout0 = this.device.createBindGroupLayout({
			label: 'group layout #0',
			entries: [{
				binding: 0, // u_mat
				visibility: GPUShaderStage.VERTEX,
				buffer: {
					type: "uniform"
				}
			},
			{
				binding: 1, // sampler
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {}
			},

			{
				binding: 2, // u_uniforms
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform"
				}
			},
			{
				binding: 3, // u_height
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform"
				}
			},
			],
		});

		this.bindGroupLayout1 = this.device.createBindGroupLayout({
			label: 'group layout #1',
			entries: [{
				binding: 0, // texture
				visibility: GPUShaderStage.FRAGMENT,
				texture: {}
			},
			]
		});

		this.pipelineLayout = this.device.createPipelineLayout({
			label: 'bg pipeline layout',
			bindGroupLayouts: [bindGroupLayout0, this.bindGroupLayout1],
		});

		this.pipelines = new Array(blendStates.length);
		this.pipelines[0] = this.getPipeline(0);
		this.pipelines[1] = this.getPipeline(1);

		this.bindGroup0 = this.device.createBindGroup({
			label: 'common bind group',
			layout: bindGroupLayout0,
			entries: [
			{
				binding: 0, // u_mat
				resource: {
					buffer: this.uMatBuffer
				}
			},
			{
				binding: 1, // sampler
				resource: this.sampler
			},
			{
				binding: 2, // u_uniforms
				resource: {
					buffer: this.uUniformsBuffer,
				}
			},
			{
				binding: 3, // u_height
				resource: {
					buffer: this.uHeightBuffer
				}
			},
		]});

		this.bindGroup1 = this.device.createBindGroup({
			label: 'dummy texture bind group',
			layout: this.bindGroupLayout1,
			entries: [{
				binding: 0, // Use dummy texture
				resource: this.dummyTexture.createView()
			}]
		});

		this.uniformsArrView = new DataView(this.uniformsArr.buffer);
		// most devices use little endendian
		this.isLittleEndian = new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x78;
	}

	getPipeline(index: number): GPURenderPipeline {
		const instance = this.pipelines[index];
		if (instance)
			return instance;

		return this.pipelines[index] = this.device.createRenderPipeline({
			label: `pipeline for blend state #${index}`,
			layout: this.pipelineLayout,
			vertex: {
				module: this.shaderModule,
				entryPoint: "vs",
				buffers: [{
					arrayStride: (2 + 2) * Float32Array.BYTES_PER_ELEMENT,
					stepMode: 'vertex',
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x2"
						},
						{
							shaderLocation: 1,
							offset: 2 * Float32Array.BYTES_PER_ELEMENT,
							format: "float32x2"
						},
					]
				}]
			},
			fragment: {
				module: this.shaderModule,
				entryPoint: "fs",
				targets: [{
						format: this.presentationFormat,
						blend: blendStates[index],
				}],
			},
			primitive: {
				topology: "triangle-strip",
			},
		});
	}

	override drawImage(bimg: FakeImage, x: number, y: number, w: number, h: number): void {
		const img = bimg as GPUImage;

		//
		// first draw
		// position (  #0: pos.x,           #1: pos.y )
		// texCoord (  #2: img.x,           #3: img.y )
		//
		// second draw
		// position (  #4: pos.x,           #5: pos.y + pos.h )
		// texCoord (  #6: img.x,           #7: img.y + img.h )
		//
		// third draw
		// position (  #8: pos.x + pos.w,   #9: pos.y )
		// texCoord ( #10: img.x + img.w,  #11: img.y )
		//
		// fourth draw
		// position ( #12: pos.x + pos.w,  #13: pos.y + pos.h )
		// texCoord ( #14: img.x + img.w,  #15: img.y + img.h )
		//

		this.imgArr[2] = this.imgArr[6] = img.x / img.bitmap.width;
		this.imgArr[3] = this.imgArr[11] = img.y / img.bitmap.height;
		this.imgArr[10] = this.imgArr[14] = (img.x + img.w) / img.bitmap.width;
		this.imgArr[7] = this.imgArr[15] = (img.y + img.h) / img.bitmap.height;
		
		const p = new DOMPoint();

		const xw = x + w;
		const yh = y + h;

		this.transformPoint(p, x, y);
		this.imgArr[0] = p.x;
		this.imgArr[1] = p.y;

		this.transformPoint(p, x, yh);
		this.imgArr[4] = p.x;
		this.imgArr[5] = p.y;

		this.transformPoint(p, xw, y);
		this.imgArr[8] = p.x;
		this.imgArr[9] = p.y;

		this.transformPoint(p, xw, yh);
		this.imgArr[12] = p.x;
		this.imgArr[13] = p.y;

		this.device.queue.writeBuffer(this.imgBuffer, 0, this.imgArr);

		const commandEncoder = this.device.createCommandEncoder();
		const passEncoder = commandEncoder.beginRenderPass({
			colorAttachments: [{
				view: this.context.getCurrentTexture().createView(),
				loadOp: 'load',
				storeOp: 'store',
			}]
		});

		passEncoder.setPipeline(this.imgPipeline!);
		passEncoder.setVertexBuffer(0, this.imgBuffer);
		passEncoder.setBindGroup(0, this.bindGroup0);
		passEncoder.setBindGroup(1, img.group);
		passEncoder.draw(4, 1, 0, 0);
		passEncoder.end();

		this.device.queue.submit([commandEncoder.finish()]);
	}

	override setComposite(mode: BlendMode, opa: number, glow: number) {
		let newMode = 1;

		switch (mode) {
			case BlendMode.DEF:
				this.imgPipeline = this.pipelines[1];

				if (this.oldMode === (newMode = 3))
					return;
				break;

			case BlendMode.TRANS:
				this.imgPipeline = this.pipelines[1];

				if (this.oldMode === newMode && this.oldOpa === opa)
					return;
				
				this.uniformsArr[7] = opa;
				this.oldOpa = opa;
				break;

			case BlendMode.BLEND:

				switch (glow) {

					case 0:
						this.imgPipeline = this.pipelines[1];
						break;

					case 1:
						this.imgPipeline = this.getPipeline(2);
						break;

					case 2:
						newMode = 2;
						this.imgPipeline = this.getPipeline(3);
						break;

					case 3:
						this.imgPipeline = this.getPipeline(4);
						break;

					case -1:
						this.imgPipeline = this.getPipeline(5);
						break;

					case -2:
						this.imgPipeline = this.getPipeline(6);
						break;

				}

				if (this.oldOpa === opa && this.oldMode === newMode)
					return;

				this.uniformsArr[7] = opa;
				this.oldOpa = opa;

				break;
		}

		this.uniformsArrView.setUint32(12, (this.oldMode = newMode), this.isLittleEndian);
		this.device.queue.writeBuffer(this.uUniformsBuffer, 0, this.uniformsArr);
	}

	override async buildImg(blob: Blob): Promise<FakeImage> {
		const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none' });
		return this.buildImgFromBitmap(bitmap);
	}

	buildImgFromBitmap(bitmap: ImageBitmap): GPUImage {
		const texture = this.device.createTexture({
			size: [bitmap.width, bitmap.height, 1],
			format: "rgba8unorm",
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
		});

		this.device.queue.copyExternalImageToTexture(
			{ source: bitmap },
			{ texture: texture, premultipliedAlpha: true },
			[ bitmap.width, bitmap.height ]
		);

		const group = this.device.createBindGroup({
			label: `img(${bitmap.width}pix, ${bitmap.height}pix) bind group`,
			layout: this.bindGroupLayout1,
			entries: [{
				binding: 0,
				resource: texture.createView()
			}]
		});

		return new GPUImage(bitmap, texture, group);
	}

	override disposeImg(bimg: FakeImage) {
		const img = bimg as GPUImage;
		img.tex.destroy();
		img.bitmap.close();
	}

	override resize(width: number, height: number) {
		//
		// first draw
		// position (  #0: 0,   #1: 0 )
		// texCoord (  #2: ?,   #3: ? )
		//
		// second draw
		// position (  #4: 0,   #5: h )
		// texCoord (  #6: ?,   #7: ? )
		//
		// third draw
		// position (  #8: w,   #9: 0 )
		// texCoord ( #10: ?,  #11: ? )
		//
		// fourth draw
		// position ( #12: w,  #13: h )
		// texCoord ( #14: ?,  #15: ? )
		//
		//
		// draw (0, 0) - (0, h) - (w, 0) - (w, h) (triangle-strip)
		// texCoord is not used in fragment shader, so dummy value is ok.

		this.bgArr[8] = this.bgArr[12] = width;
		this.bgArr[5] = this.bgArr[13] = height;

		this.device.queue.writeBuffer(this.uHeightBuffer, 0, new Float32Array([height]));
		this.device.queue.writeBuffer(this.uMatBuffer, 0, orthographic(0, width, height, 0, -1, 1));
		this.device.queue.writeBuffer(this.bgBuffer, 0, this.bgArr);

		super.resize(width, height);
		this.drawBG();
	}

	override setBG(c1: number[], c2: number[]) {
		for (let i = 0;i < 3;++i)
			this.uniformsArr[i] = c1[i] / 255;

		for (let i = 0;i < 3;++i)
			this.uniformsArr[i + 4] = (c2[i] - c1[i]) / 127.5;

		// will update uniformsArr in drawBG
	}

	override drawBG() {
		this.oldMode = -1;
		this.uniformsArrView.setUint32(12, 0, this.isLittleEndian);
		this.device.queue.writeBuffer(this.uUniformsBuffer, 0, this.uniformsArr);

		const commandEncoder = this.device.createCommandEncoder({ label: 'bg encoder' });
		const passEncoder = commandEncoder.beginRenderPass({
			label: 'bg pass',
			colorAttachments: [{
				view: this.context.getCurrentTexture().createView(),
				loadOp: 'clear',
				storeOp: 'store',
				clearValue: { r: 0, g: 0, b: 0, a: 0 },
			}]
		});

		passEncoder.setPipeline(this.pipelines[0]);
		passEncoder.setVertexBuffer(0, this.bgBuffer);
		passEncoder.setBindGroup(0, this.bindGroup0);
		passEncoder.setBindGroup(1, this.bindGroup1);
		passEncoder.draw(4, 1, 0, 0);
		passEncoder.end();

		this.device.queue.submit([commandEncoder.finish()]);
	}

	override clearWindow() {
		const commandEncoder = this.device.createCommandEncoder({ label: 'clear window encoder' });
		const passEncoder = commandEncoder.beginRenderPass({
			label: 'clear windiw pass',
			colorAttachments: [{
				view: this.context.getCurrentTexture().createView(),
				loadOp: 'clear',
				storeOp: 'store',
				clearValue: { r: 0, g: 0, b: 0, a: 0 }
			}]
		});
		passEncoder.end();
		this.device.queue.submit([commandEncoder.finish()]);
	}

	// @TODO: Use VideoFrame.copyTo() or other APIs to improve performance?
	override async getImageData(): Promise<Uint8ClampedArray> {
		const texture = this.context.getCurrentTexture();
		const width = texture.width;
		const height = texture.height;
		const COPY_BYTES_PER_ROW_ALIGNMENT = 256;

		// Calculate bytes per row (aligned to 256 bytes)
		const bytesPerRow = Math.ceil(width * 4 / COPY_BYTES_PER_ROW_ALIGNMENT) * COPY_BYTES_PER_ROW_ALIGNMENT;

		// Create a buffer to hold the data
		const buffer = this.device.createBuffer({
			label: 'image data buffer',
			size: bytesPerRow * height,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
		});

		// Encode copy command
		const encoder = this.device.createCommandEncoder({ label: 'copy imgage data encoder' });
		encoder.copyTextureToBuffer(
			{ texture },
			{ buffer, bytesPerRow },
			{ width, height, depthOrArrayLayers: 1 }
		);
		this.device.queue.submit([encoder.finish()]);

		// Read buffer data
		await buffer.mapAsync(GPUMapMode.READ);
		const data = new Uint8Array(buffer.getMappedRange());

		// Remove padding from each row
		const pixels = new Uint8ClampedArray(width * height * 4);
		for (let y = 0; y < height; y++) {
			const srcStart = y * bytesPerRow;
			const srcEnd = srcStart + width * 4;
			const dstStart = y * width * 4;
			pixels.set(data.subarray(srcStart, srcEnd), dstStart);
		}

		buffer.unmap();

		switch (this.presentationFormat) {
			case 'rgba8unorm':
				break;
			case 'bgra8unorm':
				for (let i = 0; i < pixels.length; i += 4) {
					[pixels[i], pixels[i + 2]] = [pixels[i + 2], pixels[i]];
				}
				break;
			default:
				throw new Error(`Unknown texture format: ${this.presentationFormat}`);
		}

		return pixels;
	}
};
