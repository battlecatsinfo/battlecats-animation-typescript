export function download(blob: Blob, filename: string) {
	const a = document.createElement('a');
	const url = URL.createObjectURL(blob);

	a.href = url;
	a.download = filename;
	a.click();

	URL.revokeObjectURL(url);
}
