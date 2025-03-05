import { LineStream } from "./types";
import { ModelPart } from "./ModelPart";
import { readInt } from "./util/util";

export class MaModel {
	constructor(
		public readonly m: number,
		public readonly ints: number[],
		public readonly confs: number[][],
		public readonly parts: number[][],
		public readonly strs0: string[],
		public readonly strs1: string[]
	) {

	}

	static load(input: LineStream) {
		input.skipLine();
		input.skipLine();
		
		const n = readInt(input.tryReadLine());

		const parts = new Array<number[]>(n);
		const strs0 = new Array<string>(n);

		for (let i = 0; i < n; i++) {
			const ss = (input.tryReadLine() || "").trim().split(",");
			parts[i] = new Array<number>(13);
			for (let j = 0; j < 13; j++)
				parts[i][j] = readInt(ss[j]);

			strs0[i] = ss.length === 14 ? ss[13].trim() : "";
		}

		const ss = (input.tryReadLine() || "").trim().split(",");
		const ints = ss.slice(0, 3).map(readInt);

		const m = readInt(input.tryReadLine());
		const confs = new Array<number[]>(m);
		const strs1 = new Array<string>(m);

		for (let i = 0; i < m; i++) {
			const ss = (input.tryReadLine() || "").trim().split(",");
			confs[i] = new Array(6);
			for (let j = 0; j < 6; j++)
				confs[i][j] = readInt(ss[j]);

			strs1[i] = ss.length === 7 ? ss[6].trim() : "";
		}
		return new MaModel(m, ints, confs, parts, strs0, strs1);
	}

	static loadDefault() {
		return new MaModel(1, [1000, 3600, 1000], [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], 
			[[-1, -1, 0, 0, 0, 0, 0, 0, 1000, 1000, 0, 1000, 0, 0]], ["default"], ["default"]);
	}

	arrange(): ModelPart[] {
		const ents = new Array(this.parts.length);

		for (let i = 0;i < ents.length;++i)
			ents[i] = new ModelPart(this, this.parts[i], this.strs0[i], i, ents)

		return ents;
	}
}
