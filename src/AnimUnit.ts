import { AnimBase } from "./AnimBase";

/**
 * Base class for cats and enemy animation.
 */
export class AnimUnit extends AnimBase {
	drawFrame(f: number) {
		this.currentAnim().update(f, this.ents, this.rotate);
		this.sort();

		this.g.drawBG();

		for (const e of this.order)
			e.drawPart(this.g, this.parts, this.sizer);
	}

	drawFrameNoUpdate() {
		this.g.drawBG();

		for (const e of this.order)
			e.drawPart(this.g, this.parts, this.sizer);
	}
};
