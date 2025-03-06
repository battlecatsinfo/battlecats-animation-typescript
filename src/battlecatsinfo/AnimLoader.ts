import { ImgCut } from "../ImgCut";
import { MaAnim } from "../MaAnim";
import { MaModel } from "../MaModel";
import { FakeGraphics } from "../types";
import { AnimUnit } from "../AnimUnit";
import { StrLineStream } from "../StrLineStream";

// @ts-ignore
import { loadScheme } from './common.mjs';

export const { eggs } = await loadScheme('units', [ 'eggs' ]);

export class AnimLoader {
	constructor(public readonly g: FakeGraphics, public forms: AnimUnit[] = []) {

	}

	async load(id: number) {
		if (this.forms.length) {
			for (const f of this.forms)
				f.unload();
			this.forms.length = 0;
		}
		const res = (id < 0) ? this.loadEnemy(- (id + 1)) : this.loadUnit(id);
		await res;
	}

	static async fetch(url: string | URL | Request, options?: RequestInit): Promise<Response> {
		const response = await fetch(url, options).catch(ex => {
			throw new Error(`Unable to fetch "${url}": ${ex.message}`);
		});

		if (!response.ok) {
			throw new Error(`Bad response when fetching "${url}": ${response.status} ${response.statusText}`, { cause: response });
		}

		return response;
	}

	async loadEnemy(id: number) {
		const [resJson, resBlob] = await Promise.all([
			AnimLoader.fetch(`/img/e/${id}/a`),
			AnimLoader.fetch(`/img/e/${id}/c.png`),
		]);
		const json = await resJson.json() as string[];
		const blob = await resBlob.blob();
		this.forms = [
			new AnimUnit(
				this.g,
				ImgCut.load(new StrLineStream(json[0])),
				await this.g.buildImg(blob),
				MaModel.load(new StrLineStream(json[1])),
				json.slice(2).map(x => (MaAnim).load(new StrLineStream(x)))
			)
		];
	}

	async loadUnit(id: number) {
		const res = await AnimLoader.fetch(`/img/u/${id}/a`);
		const datum = await res.json() as string[][];

		const egg = eggs[id];

		if (egg !== undefined) {
			const promises = egg.map(async (eggId: number) => {
				const res1 = await AnimLoader.fetch(`/img/s/${eggId}/a`);
				const a = await res1.json();
				const res2 = await AnimLoader.fetch(`/img/s/${eggId}/c.png`);
				const blob = await res2.blob();
				return [await this.g.buildImg(blob), a];
			});

			if (datum.length) {
				promises.push(...datum.map(async (_, i: number) => {
					const res = await AnimLoader.fetch(`/img/u/${id}/c${i + 2}.png`);
					const blob = await res.blob();
					return [await this.g.buildImg(blob), datum[i]];
				}));
			}
			const eggData = await Promise.all(promises);
			this.forms = [];
			for (const [img, data] of eggData) {
				this.forms.push(new AnimUnit(
					this.g,
					ImgCut.load(new StrLineStream(data[0])),
					img,
					MaModel.load(new StrLineStream(data[1])),
					data.slice(2).map((x: string) => MaAnim.load(new StrLineStream(x)))
				));
			}
		} else {
			const images = await Promise.all(datum.map(async (_, i) => {
				const res = await AnimLoader.fetch(`/img/u/${id}/c${i}.png`);
				const blob = await res.blob();
				return await this.g.buildImg(blob);
			}));
	
			this.forms = datum.map((data, i) =>
				new AnimUnit(
					this.g,
					ImgCut.load(new StrLineStream(data[0])),
					images[i],
					MaModel.load(new StrLineStream(data[1])),
					data.slice(2).map((x: string) => MaAnim.load(new StrLineStream(x)))
				)
			);
		}
	}

	setSize(siz: number) {
		for (const form of this.forms)
			form.setSize(siz, siz);
	}
};
