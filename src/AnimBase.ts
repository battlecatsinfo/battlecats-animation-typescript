import { ModelPart } from "./ModelPart";
import { ImgCut } from "./ImgCut";
import { MaAnim } from "./MaAnim";
import { MaModel } from "./MaModel";
import { P } from "./P";
import { FakeGraphics, FakeImage } from "./types";

export const enum AnimMode {
	WALK,
	IDLE,
	ATK,
	HB,
	ENTER,
	BURROW_DOWN,
	BURROW_MOVE,
	BURROW_UP,
	SOUL,
};

/**
 * Base class for animation.
 */
export class AnimBase {
	readonly parts: FakeImage[];
	readonly ents: ModelPart[];
	readonly order: ModelPart[];
	readonly sizer = new P(1, 1);

	rotate: boolean;
	cur_mode: AnimMode;

	constructor(public readonly g: FakeGraphics, public readonly cut: ImgCut, public readonly cutImg: FakeImage, public readonly model: MaModel, public readonly anims: MaAnim[]) {
		this.parts = cut.cut(cutImg);
		this.ents = this.model.arrange();
		this.order = this.ents.slice();
	}

	static isRotate(mode: AnimMode): boolean {
		switch (mode) {
			case AnimMode.ATK:
			case AnimMode.ENTER:
			case AnimMode.BURROW_DOWN:
			case AnimMode.BURROW_UP:
			case AnimMode.SOUL:
				return true;
			default:
				return false;
		}
	}

	currentMode(): AnimMode {
		return this.cur_mode;
	}

	currentAnim(): MaAnim {
		return this.anims[this.cur_mode]!;
	}

	switchMode(newMode: AnimMode) {
		this.rotate = AnimBase.isRotate(this.cur_mode = newMode);
	}

	setSize(sizX = 1, sizY = 1) {
		this.sizer.setTo(sizX, sizY);
	}

	getSize(): P {
		return this.sizer;
	}

	length() {
		return this.currentAnim().max;
	}

	unload() {
		this.g.disposeImg(this.cutImg);
	}

	getBaseSizeX(): number {
		return this.model.parts[0][8] / this.model.ints[0];
	}

	getBaseSizeY(): number {
		return this.model.parts[0][9] / this.model.ints[0];
	}

	removeBasePivot() {
		this.model.parts[0][6] = 0;
		this.model.parts[0][7] = 0;
	}

	sort() {
		this.order.sort((a, b) => a.zOrder - b.zOrder);
	}

	setValue() {
		this.currentAnim().update(0, this.ents, this.rotate);
	}
};
