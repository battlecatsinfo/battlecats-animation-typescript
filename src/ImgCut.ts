import { FakeImage, LineStream } from "./types";
import { readInt } from "./util/util";

export class ImgCut {
	constructor(readonly name: string, readonly cuts: number[][], readonly strs: string[]) {

	}

	static load(input: LineStream) {
		input.skipLine();
		input.skipLine();

		const name = input.tryReadLine()?.trim() ?? "";

		const n = readInt(input.tryReadLine());

		const cuts = new Array<number[]>(n);
		const strs = new Array<string>(n);

		for (let i = 0; i < n; i++) {
			const line = input.tryReadLine()?.trim() || "0,0,1,1";
			const values = line.split(",");
			cuts[i] = values.slice(0, 4).map(readInt);
			strs[i] = values.length === 5 ? values[4].trim() : "";
		}

		return new ImgCut(name, cuts, strs);
	}

	static loadDefault() {
		return new ImgCut("default", [], []);
	}

	public cut(bimg: FakeImage): FakeImage[] {
		const w = bimg.getWidth();
		const h = bimg.getHeight();
		return this.cuts.map(([x, y, w0, h0]) => {
			x = Math.max(0, Math.min(x, w - 1));
			y = Math.max(0, Math.min(y, h - 1));
			w0 = Math.max(1, Math.min(w0, w - x));
			h0 = Math.max(1, Math.min(h0, h - y));
			return bimg.getSubimage(x, y, w0, h0);
		});
	}
}
