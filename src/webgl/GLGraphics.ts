import { CanvasLike } from "#canvas";
import { BlendMode, FakeImage } from "../types";
import { Affine2D } from "../util/Affine2D";
import { GLImage } from "./GLImage";
import vertexShader1 from "./shaders/1.0/vertex.vert";
import fragmentShader1 from './shaders/1.0/fragment.frag';
import vertexShader2 from "./shaders/2.0/vertex.vert";
import fragmentShader2 from './shaders/2.0/fragment.frag';
import { orthographic, isPowerOf2 } from "../util/util";

type WebGLVer = 1 | 2;

export class GLGraphics extends Affine2D {
	private readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
	private readonly positionArr = new Float32Array(8);
	private readonly texCoordArr = new Float32Array(8);
	private readonly bgArr = new Float32Array(8);
	private readonly ver: WebGLVer;
	private readonly program: WebGLProgram;
	private readonly a_position: GLint;
	private readonly a_positionBufImg: WebGLBuffer;
	private readonly a_positionBufBG?: WebGLBuffer;
	private readonly a_texCoord: GLint;
	private readonly a_texCoordBuf: WebGLBuffer;
	private readonly vaoImg?: WebGLVertexArrayObject;
	private readonly vaoBG?: WebGLVertexArrayObject;
	private readonly u_mode: WebGLUniformLocation;
	private readonly u_mat: WebGLUniformLocation;
	private readonly u_para: WebGLUniformLocation;
	private readonly u_c1: WebGLUniformLocation;
	private readonly u_c2: WebGLUniformLocation;
	private readonly u_height: WebGLUniformLocation;

	private mode: number = -1;
	private oldMode: number = -1;
	private sfactor: number = -1;
	private dfactor: number = -1;
	private blendSub = false;
	private oldPara: number = -1;

	constructor(canvas: CanvasLike, options = {}) {
		super(canvas);

		const opts = {
			premultipliedAlpha: false,
			depth: false,
			stencil: false,
			...options,
		};

		const gl2 = canvas.getContext("webgl2", opts) as WebGL2RenderingContext;
		if (gl2) {
			this.ver = 2;
			this.gl = gl2;
		} else {
			console.warn('WebGL 2 is not supported. Fallback to WebGL 1');
			const gl1 = canvas.getContext("webgl", opts) as WebGLRenderingContext;
			if (!gl1)
				throw new Error("WebGL is not supported in your browser!");
			this.ver = 1;
			this.gl = gl1;
		}

		this.program = this.gl.createProgram()!;
		if (!this.program)
			throw new Error('Failed to create WebGL program.');

		this.shader(this.gl.VERTEX_SHADER, gl2 ? vertexShader2 : vertexShader1);
		this.shader(this.gl.FRAGMENT_SHADER, gl2 ? fragmentShader2 : fragmentShader1);
		this.gl.linkProgram(this.program);
		this.gl.useProgram(this.program);

		this.a_position = this.gl.getAttribLocation(this.program, 'a_position');
		this.a_texCoord = this.gl.getAttribLocation(this.program, 'a_texCoord');
		this.u_mode = this.gl.getUniformLocation(this.program, 'u_mode')!;
		this.u_mat = this.gl.getUniformLocation(this.program, 'u_mat')!;
		this.u_para = this.gl.getUniformLocation(this.program, 'u_para')!;
		this.u_c1 = this.gl.getUniformLocation(this.program, 'u_c1')!;
		this.u_c2 = this.gl.getUniformLocation(this.program, 'u_c2')!;
		this.u_height = this.gl.getUniformLocation(this.program, 'u_height')!;
		
		if (gl2) {
			this.vaoImg = gl2.createVertexArray()!;
			gl2.bindVertexArray(this.vaoImg);
		}

		this.a_positionBufImg = this.gl.createBuffer()!;
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.a_positionBufImg);
		this.gl.vertexAttribPointer(this.a_position, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.a_position);

		this.a_texCoordBuf = this.gl.createBuffer()!;
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.a_texCoordBuf);
		this.gl.vertexAttribPointer(this.a_texCoord, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.a_texCoord);

		if (gl2) {
			this.vaoBG = gl2.createVertexArray()!;
			gl2.bindVertexArray(this.vaoBG);
			this.a_positionBufBG = this.gl.createBuffer()!;
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.a_positionBufBG)!;
			this.gl.vertexAttribPointer(this.a_position, 2, this.gl.FLOAT, false, 0, 0);
			this.gl.enableVertexAttribArray(this.a_position);
		}

		this.gl.clearColor(0, 0, 0, 0);

		this.ready = Promise.resolve();
	}

	private shader(type: number, source: string) {
		const shader = this.gl.createShader(type);
		if (!shader)
			throw new Error('Failed to create shader.');
		this.gl.shaderSource(shader, source);
		this.gl.compileShader(shader);
		if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS))
			throw new Error('Compile shader failed:\n' + this.gl.getShaderInfoLog(shader));

		this.gl.attachShader(this.program, shader);
	}

	override drawImage(bimg: GLImage, x: number, y: number, w: number, h: number): void {
		const img = bimg as GLImage;
		this.texCoordArr[0] = this.texCoordArr[2] = img.x;
		this.texCoordArr[1] = this.texCoordArr[5] = img.y;
		this.texCoordArr[4] = this.texCoordArr[6] = img.x + img.w;
		this.texCoordArr[3] = this.texCoordArr[7] = img.y + img.h;

		for (let i = 0;i < 8;i += 2) {
			this.texCoordArr[i] /= img.bitmap.width;
			this.texCoordArr[i + 1] /= img.bitmap.height;
		}

		const p = new DOMPoint();

		const xw = x + w;
		const yh = y + h;

		this.transformPoint(p, x, y);
		this.positionArr[0] = p.x;
		this.positionArr[1] = p.y;

		this.transformPoint(p, x, yh);
		this.positionArr[2] = p.x;
		this.positionArr[3] = p.y;

		this.transformPoint(p, xw, y);
		this.positionArr[4] = p.x;
		this.positionArr[5] = p.y;

		this.transformPoint(p, xw, yh);
		this.positionArr[6] = p.x;
		this.positionArr[7] = p.y;

		if (this.ver === 2)
			(this.gl as WebGL2RenderingContext).bindVertexArray(this.vaoImg!);

		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.a_positionBufImg);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, this.positionArr, this.gl.STATIC_DRAW);

		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.a_texCoordBuf);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, this.texCoordArr, this.gl.STATIC_DRAW);

		this.gl.bindTexture(this.gl.TEXTURE_2D, img.tex);

		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
	}

	private checkMode(newMode: number) {
		if (this.mode === newMode)
			return;
	
		this.mode = newMode;

		if (newMode === 0) {
			this.gl.uniform1i(this.u_mode, this.oldMode = 0);
			this.gl.disable(this.gl.BLEND);
		} else if (newMode === 1) {
			this.gl.enable(this.gl.BLEND);
		}
	}

	override setComposite(mode: BlendMode, opa: number, glow: number) {
		let newMode = 1;
		let sfactor: number = this.gl.ONE;
		let dfactor: number = this.gl.ONE_MINUS_SRC_ALPHA;
		let sub = false;

		this.checkMode(1);

		switch (mode) {
			case BlendMode.DEF:
				newMode = 3;
				break;

			case BlendMode.TRANS:
				if (this.oldPara !== opa)
					this.gl.uniform1f(this.u_para, this.oldPara = opa);
				break;

			case BlendMode.BLEND:
				if (this.oldPara !== opa)
					this.gl.uniform1f(this.u_para, this.oldPara = opa);

				switch (glow) {
				case 0:
					break;

				case 1:
					dfactor = this.gl.ONE;
					break;

				case 2:
					sfactor = this.gl.ZERO;
					dfactor = this.gl.SRC_COLOR;
					newMode = 2;
					break;
				
				case 3:
					sfactor = this.gl.ONE_MINUS_DST_COLOR;
					dfactor = this.gl.ONE;
					break;

				case -1:
					this.gl.blendEquation(this.gl.FUNC_REVERSE_SUBTRACT);
					sub = this.blendSub = true;
					dfactor = this.gl.ONE;
					break;

				case -2:
					sfactor = this.gl.SRC_ALPHA;
					break;
				}
				break;
		}

		if (this.oldMode !== newMode)
			this.gl.uniform1i(this.u_mode, this.oldMode = newMode);

		if (sfactor !== this.sfactor || dfactor !== this.dfactor)
			this.gl.blendFunc(this.sfactor = sfactor, this.dfactor = dfactor);
		
		if (this.blendSub && !sub) {
			this.gl.blendEquation(this.gl.FUNC_ADD);
			this.blendSub = false;
		}
	}

	override async buildImg(blob: Blob): Promise<FakeImage> {
		const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'premultiply' });

		return this.buildImgFromBitmap(bitmap);
	}

	buildImgFromBitmap(bitmap: ImageBitmap): GLImage {
		const tex = this.gl.createTexture();

		this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
		this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, bitmap);

		if (this.ver === 2) {
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
		} else {
			if (isPowerOf2(bitmap.width) && isPowerOf2(bitmap.height)) {
				this.gl.generateMipmap(this.gl.TEXTURE_2D);
			} else {
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
			}
		}

		return new GLImage(bitmap, tex);
	}

	override disposeImg(bimg: FakeImage) {
		const img = bimg as GLImage;
		this.gl.deleteTexture(img.tex);
		img.bitmap.close();
	}

	override resize(width: number, height: number) {
		this.bgArr[4] = this.bgArr[6] = width;
		this.bgArr[3] = this.bgArr[7] = height;

		this.gl.viewport(0, 0, width, height);
		this.gl.uniform1f(this.u_height, height);
		this.gl.uniformMatrix4fv(this.u_mat, false, orthographic(0, width, height, 0, -1, 1));

		if (this.ver === 2) {
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.a_positionBufBG!);
			this.gl.bufferData(this.gl.ARRAY_BUFFER, this.bgArr, this.gl.STATIC_DRAW);
		}

		super.resize(width, height);
		this.drawBG();
	}

	override setBG(c1: number[], c2: number[]) {
		this.gl.uniform3f(this.u_c1, c1[0]/255, c1[1]/255, c1[2]/255);
		this.gl.uniform3f(this.u_c2, (c2[0] - c1[0])/127.5, (c2[1] - c1[1])/127.5, (c2[2] - c1[2])/127.5);
	}

	override drawBG() {
		this.checkMode(0);
		if (this.ver === 2) {
			(this.gl as WebGL2RenderingContext).bindVertexArray(this.vaoBG!);
		} else {
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.a_positionBufImg);
			this.gl.bufferData(this.gl.ARRAY_BUFFER, this.bgArr, this.gl.STATIC_DRAW);
		}

		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
	}

	override clearWindow(): void {
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);
	}

	override getImageData(): Promise<Uint8ClampedArray> {
		const data = new Uint8ClampedArray(this.getWidth() * this.getHeight() * 4);
		this.gl.readPixels(0, 0, this.getWidth(), this.getHeight(), this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
		return Promise.resolve(data);
	}
};
