import { FakeGraphics, FakeImage, BlendMode } from "./types";
import { P } from "./P";
import { toInt, toIntFast } from "./util/util";
import { opaNotFull } from "./config";

export const randSeries: number[] = [];

export function drawImg(g: FakeGraphics, bimg: FakeImage, piv: P, sc: P, opa: number, glow: number, extendX: number, extendY: number) {
	const glowSupport = (glow >= 1 && glow <= 3) || glow === -1;
	if (opaNotFull(opa)) {
		if (glowSupport)
			g.setComposite(BlendMode.BLEND, opa, glow);
		else
			g.setComposite(BlendMode.TRANS, opa, 0);
	} else {
		if (glowSupport)
			g.setComposite(BlendMode.BLEND, 1, glow);
		else
			g.setComposite(BlendMode.DEF, 0, 0);
	}
	if (extendX == 0 && extendY == 0)
		g.drawImage(bimg, -piv.x, -piv.y, sc.x, sc.y);
	else {
		let x = -piv.x;
		let y = -piv.y;

		let oldExtendY = extendY;
		let oldExtendX = extendX;

		if (extendY == 0) {
			while (extendX > 1) {
				g.drawImage(bimg, x, y, sc.x, sc.y);
				x += sc.x;
				extendX--;
			}
		} else {
			const extendXBackup = extendX;

			while (extendY > 1) {
				if (extendX == 0) {
					g.drawImage(bimg, x, y, sc.x, sc.y);
				} else {
					x = -piv.x;
					extendX = extendXBackup;

					while (extendX > 1) {
						g.drawImage(bimg, x, y, sc.x, sc.y);
						x += sc.x;
						extendX--;
					}
				}

				y += sc.y;
				extendY--;
			}
		}
		const w = bimg.getWidth();
		const h = bimg.getHeight();
		if (w > 0) {
			if (extendY == 0) {
				const parX = bimg.getSubimage(0, 0, toIntFast(Math.max(1, w * extendX)), h);

				g.drawImage(parX, x, y, sc.x * extendX, sc.y);
			} else {
				const parY = bimg.getSubimage(0, 0, w, toIntFast(Math.max(1, h * extendY)));

				if (extendX == 0) {
					g.drawImage(parY, x, y, sc.x, sc.y * extendY);
				} else {
					const parX = bimg.getSubimage(0, 0, toIntFast(Math.max(1, w * extendX)), h);
					const parXY = bimg.getSubimage(0, 0, parX.getWidth(), parY.getHeight());

					y = -piv.y;

					while (oldExtendY > 1) {
						g.drawImage(parX, x, y, sc.x * extendX, sc.y);

						y += sc.y;
						oldExtendY--;
					}

					x = -piv.x;

					while (oldExtendX > 1) {
						g.drawImage(parY, x, y, sc.x, sc.y * extendY);

						x += sc.x;
						oldExtendX--;
					}

					g.drawImage(parXY, x, y, sc.x * extendX, sc.y * extendY);
				}
			}
		}
	}
}

export function drawRandom(g: FakeGraphics, bimg: FakeImage[], piv: P, sc: P, opa: number, glow: boolean, extendX: number, extendY: number) {
	if (opaNotFull(opa))
		if (!glow)
			g.setComposite(BlendMode.TRANS, opa, 0);
		else
			g.setComposite(BlendMode.BLEND, opa, 1);
	else if (glow)
		g.setComposite(BlendMode.BLEND, 1, 1);
	else
		g.setComposite(BlendMode.DEF, 0, 0);
	if (extendX == 0)
		g.drawImage(bimg[0], -piv.x, -piv.y, sc.x, sc.y);
	else {
		let x = -piv.x;
		let i = 0;
		while (extendX > 1) {
			let data: number;

			if (i >= randSeries.length) {
				data = toInt(Math.random() * 3);

				randSeries.push(data);
			} else {
				data = randSeries[i];
			}

			const ranImage = bimg[data];
			g.drawImage(ranImage, x, -piv.y, sc.x, sc.y);
			x += sc.x;
			extendX--;
			i++;
		}

		const w = toInt(bimg[0].getWidth() * extendX);
		const h = bimg[0].getHeight();
		if (w > 0) {
			const par = bimg[0].getSubimage(0, 0, w, h);

			g.drawImage(par, x, -piv.y, sc.x * extendX, sc.y);
		}
	}
}
