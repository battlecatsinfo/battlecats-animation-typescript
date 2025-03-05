import { LineStream } from "./types";

export class StrLineStream extends LineStream {

	constructor(private readonly content: string, private pos = 0) {
		super();
	}

	override tryReadLine(): string | null {
		if (this.pos >= this.content.length) return null;
		let tmp = this.pos;
		this.pos = this.content.indexOf('\n', tmp);
		if (this.pos == -1) {
			this.pos = this.content.length;
			return this.content.slice(tmp);
		}
		let x = this.content.slice(tmp, this.pos++);
		if (x.includes('\r'))
			return x.replaceAll('\r', '');
		return x;
	}
}
