declare module 'mp4-wasm' {
	export default function loadMP4Module(): Promise<any>;

	export function isWebCodecsSupported(): boolean;
}
