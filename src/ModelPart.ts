import * as ImgCore from "./ImgCore";
import { MaModel } from "./MaModel";
import { P } from "./P";
import { toInt } from "./util/util";
import { FakeGraphics, FakeImage, ModificationType } from "./types";
import { opaDead } from "./config";

export class ModelPart {
	parent?: ModelPart;
	id: number;
	img: number;
	pos = new P();
	piv = new P();
	sca = new P();
	zOrder: number;
	glow: number;
	extType: number;
	angle: number;
	opacity: number;
	extendX: number;
	extendY: number;
	gsca: number;
	hf: number;
	vf: number;
	
	constructor(
		public readonly model: MaModel,
		public readonly args: number[],
		public readonly name: string,
		public readonly ind: number,
		public readonly ents: ModelPart[]
	) {
		// this.setValue(); no need to call now because at frame 0 will call this.
	}

	/**
	 * Reset all values. Must called at animation frame 0.
	 */
	setValue() {
		if (this.args[0] >= this.ents.length)
			this.args[0] = 0;
		this.parent = this.args[0] <= -1 ? undefined : this.ents[this.args[0]];
		this.id = this.args[1];
		this.img = this.args[2];
		this.zOrder = this.args[3] * this.ents.length + this.ind;
		this.pos.setTo(this.args[4], this.args[5]);
		this.piv.setTo(this.args[6], this.args[7]);
		this.sca.setTo(this.args[8], this.args[9]);
		this.angle = this.args[10];
		this.opacity = this.args[11];
		this.glow = this.args[12];
		// this.extendX = this.args[13];
		this.gsca = this.model.ints[0];
		this.hf = this.vf = 1;
		this.extendX = this.extendY = 0;
		this.extType = 0;
	}

	alter(m: ModificationType, v: number) {
		switch (m) {
			case ModificationType.PARENT:
				if (v < this.ents.length && v >= 0 && v !== this.ind)
					this.parent = this.ents[toInt(v)];
				else
					this.parent = this.ents[0];
				break;

			case ModificationType.ID:
				this.id = toInt(v);
				break;

			case ModificationType.SPRITE:
				if (this.extType === 1 && this.img !== v)
					for (let i = 0;i < ImgCore.randSeries.length;++i) {
						let r = ImgCore.randSeries[i];
						
						++r;
						r = r > 3 ? 0 : r;
						ImgCore.randSeries[i] = r;
					}
				
				this.img = toInt(v);
				break;
			
			case ModificationType.Z_ORDER:
				this.zOrder = toInt(v * this.ents.length + this.ind);
				break;
			
			case ModificationType.POS_X:
				this.pos.x = this.args[4] + v;
				break;

			case ModificationType.POS_Y:
				this.pos.y = this.args[5] + v;
				break;
			
			case ModificationType.PIVOT_X:
				this.piv.x = this.args[6] + v;
				break;
			
			case ModificationType.PIVOT_Y:
				this.piv.y = this.args[7] + v;
				break;
			
			case ModificationType.SCALE:
				this.sca.x = (this.args[8] * v) / this.model.ints[0];
				this.sca.y = (this.args[9] * v) / this.model.ints[0];
				break;
			
			case ModificationType.SCALE_X:
				this.sca.x = (this.args[8] * v) / this.model.ints[0];
				break;
			
			case ModificationType.SCALE_Y:
				this.sca.y = (this.args[9] * v) / this.model.ints[0];
				break;
			
			case ModificationType.ANGLE:
				this.angle = this.args[10] + v;
				break;
			
			case ModificationType.OPACITY:
				this.opacity = v * this.args[11] / this.model.ints[2];
				break;
			
			case ModificationType.HORIZONTAL_FLIP:
				this.hf = v === 0 ? 1 : -1;
				break;
			
			case ModificationType.VERTICAL_FLIP:
				this.vf = v === 0 ? 1 : -1;
				break;
			
			case ModificationType.EXTENT_X:
				this.extendX = v;
				this.extType = 0;
				break;
			
			case ModificationType.EXTENT_X2:
				this.extendX = v;
				this.extType = 1;
				break;
			
			case ModificationType.EXTENT_Y:
				this.extendY = v;
				this.extType = 0;
				break;
			
			case ModificationType.SCALE_MULT:
				this.gsca = v;
				break;

			default:
				console.assert(false, `unhandled modification type: ${m}`);
				break;
		}
	}

	drawPart(g: FakeGraphics, parts: FakeImage[], base: P) {
		if (this.img < 0 || this.id < 0 || opaDead(this.opa()) || !parts[this.img])
			return;

		const at = g.getTransform();
		this.transform(g, base);
		const bimg = parts[this.img];
		const w = bimg.getWidth();
		const h = bimg.getHeight();
		const p0 = this.getSize();
		const tpiv = this.piv.clone().timesP(p0).timesP(base);
		const sc = new P(w, h).timesP(p0).timesP(base);
		if (this.extType === 0)
			ImgCore.drawImg(g, bimg, tpiv, sc, this.opa(), this.glow, this.extendX / this.model.ints[0], this.extendY / this.model.ints[0]);
		else if (this.extType === 1)
			ImgCore.drawRandom(g, [ parts[3], parts[4], parts[5], parts[6] ], tpiv, sc, this.opa(),
					this.glow === 1, this.extendX / this.model.ints[0], this.extendY / this.model.ints[0]);
		g.setTransform(at);
	}

	private getSize(): P {
		const mi = 1 / this.model.ints[0];

		if (!this.parent)
			return this.sca.clone().times(this.gsca * mi * mi);

		return this.parent.getSize().timesP(this.sca).times(this.gsca * mi * mi);
	}

	private opa(): number {
		if (this.opacity === 0)
			return 0;
		if (this.parent)
			return this.parent.opa() * this.opacity / this.model.ints[2];
		return this.opacity / this.model.ints[2];
	}

	private getBaseSize(parent: boolean): P {
		if (this.model.confs.length > 0) {
			const mi = 1 / this.model.ints[0];

			if(parent) {
				if(this.parent != null) {
					return this.parent.getBaseSize(true).times2(Math.sign(this.model.parts[this.ind][8]), Math.sign(this.model.parts[this.ind][9]));
				} else {
					return new P(Math.sign(this.model.parts[this.ind][8]), Math.sign(this.model.parts[this.ind][9]));
				}
			} else {
				if(this.model.confs[0][0] === -1) {
					return new P(this.model.parts[0][8] * mi, this.model.parts[0][9] * mi);
				} else {
					if (this.model.confs[0][0] === this.ind) {
						return new P(this.model.parts[this.model.confs[0][0]][8] * mi, this.model.parts[this.model.confs[0][0]][9] * mi);
					} else {
						return this.ents[this.model.confs[0][0]].getBaseSize(true).times2(this.model.parts[this.model.confs[0][0]][8] * mi, this.model.parts[this.model.confs[0][0]][9] * mi);
					}
				}
			}
		} else {
			return new P(1, 1);
		}
	}

	private transform(g: FakeGraphics, sizer: P): void {
		if (this.parent) {
			this.parent.transform(g, sizer);
		}

		if (this.ents[0] !== this) {
			const scaledPosition = this.parent ? this.parent.getSize().timesP(sizer).timesP(this.pos) : sizer.clone().timesP(this.pos);

			g.translate(scaledPosition.x, scaledPosition.y);
			g.scale(this.hf, this.vf);
		} else {
			if (this.model.confs.length > 0) {
				const data = this.model.confs[0];

				const p0 = this.getBaseSize(false).times2(data[2], data[3]).timesP(sizer);

				g.translate(-p0.x, -p0.y);
			}

			const p0 = this.getSize().timesP(sizer).timesP(this.piv);

			g.translate(p0.x, p0.y);
		}

		if (this.angle !== 0)
			g.rotate(Math.PI * 2 * this.angle / this.model.ints[1]);
	}
};
