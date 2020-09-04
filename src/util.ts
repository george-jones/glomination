
export function colorArrayToRGB(color: number[]): string {
	return 'rgb(' + color.map((n) => Math.floor(n * 255)).join(',') + ')';
}

export function colorArrayToForegroundRGB(color: number[]): string {
	let pb = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;

	if (pb > 0.5) {
		return colorArrayToRGB([0.1, 0.1, 0.1]);
	} else {
		return colorArrayToRGB([0.9, 0.9, 0.9]);
	}
}

export function domRemoveChildren(ele: Element) {
	while (ele.firstChild) {
		ele.removeChild(ele.lastChild);
	}
}

export function elementColorize(ele: HTMLElement, color: number[]) {
	ele.style.backgroundColor = colorArrayToRGB(color);
	ele.style.color = colorArrayToForegroundRGB(color);
}