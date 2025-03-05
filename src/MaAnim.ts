import { LineStream, ModificationType, EaseType } from "./types";
import { ModelPart } from "./ModelPart";
import { toInt, toIntFast, readInt } from "./util/util";

class KeyFrame {
	frame: number;
	readonly change: number;
	readonly easeType: EaseType;
	readonly easePower: number;

	constructor(ints: number[], modif: ModificationType) {
		this.frame = ints[0];
		this.change = ints[1];
		this.easeType = ints[2];
		this.easePower = ints[3];

		if (this.change < 0 && modif == ModificationType.SPRITE)
			this.change = 0;
	}
};

class MaanimPart {
	readonly max: number;
	readonly off: number;
	readonly fir: number;

	constructor(readonly modelID: number, readonly modificationType: ModificationType,
		readonly loop: number, readonly name: string, readonly moves: KeyFrame[]
	) {
		const n = this.moves.length;

		let doff = 0;
		if (n !== 0 && (this.moves[0].frame - this.off < 0 || this.loop !== 1))
			doff -= this.moves[0].frame;

		for (const move of this.moves)
			move.frame += doff;

		this.off = doff;
		this.fir = n ? this.moves[0].frame : 0;
		this.max = n > 0 ? this.moves[n - 1].frame : 0;
	}

	static loadDefault(id = 0, modif = ModificationType.POS_Y) {
		return new MaanimPart(id, modif, -1, "", []);
	}

	static load(input: LineStream, isOld: boolean) {
		const ss = input.tryReadLine()!.trim().split(",");

		const modelID = readInt(ss[0]);
		let modif = readInt(ss[1]);
		if (isOld && modif === ModificationType.SCALE)
			modif = ModificationType.SCALE_MULT;
		const loop = readInt(ss[2]);
		const name = ss.length === 6 ? ss[5] : "";

		const n = readInt(input.tryReadLine());
		const moves = Array<KeyFrame>(n);
		for (let i = 0;i < n;++i)
			moves[i] = new KeyFrame(input.tryReadLine()?.trim().split(",").map(readInt) || [], modif);

		return new MaanimPart(modelID, modif, loop, name, moves);
	}

	getMax(): number {
		if (this.loop !== -1) {
			return this.loop > 1 ? this.fir + (this.max - this.fir) * this.loop - this.off : this.max - this.off;
		} else {
			return this.max - Math.min(this.off, 0);
		}
	}

	ensureLast(ents: ModelPart[]) {
		const n = this.moves.length;

		if (n === 0)
			return;

		ents[this.modelID].alter(this.modificationType, this.moves[n - 1].change);
	}

	update(frame: number, ents: ModelPart[]): void {
		const n = this.moves.length;
		const part = ents[this.modelID];
		let i = 0;


		for (const move of this.moves) {
			if (frame === move.frame) {
				part.alter(this.modificationType, move.change);
			} else if (i < n - 1 && frame > move.frame && frame < this.moves[i + 1].frame) {
				if (this.modificationType > 1) {
					const f0 = move.frame;
					const v0 = move.change;
					const f1 = this.moves[i + 1].frame;
					const v1 = this.moves[i + 1].change;
					const realFrame = f1 - f0 === 1 ? toIntFast(frame) : frame;

					let ti = (realFrame - f0) / (f1 - f0);
					if (move.easeType === EaseType.INSTANT || this.modificationType === ModificationType.HORIZONTAL_FLIP || this.modificationType === ModificationType.VERTICAL_FLIP) {
						ti = 0;
					} else if (move.easeType === EaseType.EXPONENTIAL) {
						if (move.easePower >= 0)
							ti = 1 - Math.sqrt(1 - Math.pow(ti, move.easePower));
						else
							ti = Math.sqrt(1 - Math.pow(1 - ti, -move.easePower));
					} else if (move.easeType === EaseType.POLYNOMIAL) {
						part.alter(this.modificationType, this.ease3(i, realFrame));
						break;
					} else if (move.easeType === EaseType.SINUSOIDAL) {
						if (move.easePower > 0)
							ti = 1 - Math.cos(ti * Math.PI / 2);
						else if (move.easePower < 0)
							ti = Math.sin(ti * Math.PI / 2);
						else
							ti = (1 - Math.cos(ti * Math.PI)) / 2;
					}
					if (this.modificationType === ModificationType.SPRITE)
						if (v1 - v0 < 0)
							ti = Math.ceil((v1 - v0) * ti + v0);
						else
							ti = (v1 - v0) * ti + v0;
					else
						ti = (v1 - v0) * ti + v0;

					part.alter(this.modificationType, toInt(ti));
					break;
				} else if (this.modificationType === ModificationType.PARENT) {
					part.alter(this.modificationType, move.change);
				}
			}

			++i;
		}

		if (n > 0 && frame > this.moves[n - 1].frame)
			this.ensureLast(ents);
	}

	private ease3(i: number, frame: number): number {
		let low = i;
		let high = i;
		for (let j = i - 1; j >= 0; j--) {
			if (this.moves[j].easeType === EaseType.POLYNOMIAL) low = j;
			else break;
		}
		for (let j = i + 1; j < this.moves.length; j++) {
			if (this.moves[high = j].easeType !== EaseType.POLYNOMIAL) break;
		}
		let sum = 0;
		for (let j = low; j <= high; j++) {
			let val = this.moves[j].change * 4096;
			for (let k = low; k <= high; k++) {
				if (j !== k) val *= (frame - this.moves[k].frame) / (this.moves[j].frame - this.moves[k].frame);
			}
			sum += val;
		}
		return toInt(sum / 4096);
	}
}

export class MaAnim {
	readonly max: number;

	constructor(public readonly parts: MaanimPart[]) {
		this.max = Math.max(1, ...this.parts.map(p => p.getMax()));
	}

	static load(input: LineStream, isOld: boolean = false) {
		input.skipLine();
		input.skipLine();

		const n = readInt(input.tryReadLine());

		const parts = new Array(n);

		for (let i = 0;i < n;++i)
			parts[i] = MaanimPart.load(input, isOld);

		return new MaAnim(parts);
	}

	static loadDefault() {
		return new MaAnim([]); 
	}

	update(f: number, ents: ModelPart[], rotate: boolean) {
		if (rotate)
			f %= this.max + 1;

		if (f === 0)
			for (const e of ents)
				e.setValue();

		for (const part of this.parts) {
			const loop = part.loop;
			const smax = part.max;
			const fir = part.fir;
			const lmax = smax - fir;

			const prot = rotate || loop === -1;
			let frame: number;

			if (prot) {
				const mf = loop === -1 ? smax : this.max + 1;
				frame = mf === 0 ? 0 : (f + part.off) % mf;
			} else {
				frame = f + part.off;
			}

			if (loop > 0 && lmax !== 0) {
				if (frame > fir + loop * lmax) {
					part.ensureLast(ents);
					continue;
				}
				if (frame <= fir) {

				} else if (frame < fir + loop * lmax) {
					frame = fir + (frame - fir) % lmax;
				} else {
					frame = smax;
				}
			}

			part.update(frame, ents);
		}
	}
}
