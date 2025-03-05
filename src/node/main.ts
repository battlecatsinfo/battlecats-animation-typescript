import { StrLineStream } from "../StrLineStream";
import { ImgCut } from "../ImgCut";
import { MaModel } from "../MaModel";
import { MaAnim } from "../MaAnim";
import { Canvas } from "canvas";
import { Canvas2DGraphics } from "../canvas2d/Canvas2DGraphics";
import { AnimUnit } from "../AnimUnit";

import { readFileSync } from "node:fs";

async function loadForms(g: Canvas2DGraphics) {
	const datum = await JSON.parse(readFileSync(new URL('assets/543/a', import.meta.url), { encoding: 'utf8' })) as string[][];
	const images = await Promise.all(datum.map(async (_, i) => {
		const buffer = readFileSync(new URL(`assets/543/c${i}.png`, import.meta.url));
		return await g.buildImg(new Blob([ buffer ]));
	}));

	return datum.map((data, i) =>
		new AnimUnit(
			g,
			ImgCut.load(new StrLineStream(data[0])),
			images[i],
			MaModel.load(new StrLineStream(data[1])),
			data.slice(2).map((x: string) => MaAnim.load(new StrLineStream(x)))
		)
	);
}

const g = new Canvas2DGraphics(new Canvas(100, 100, 'image'));
const forms = await loadForms(g);
console.log(forms);
