import * as BABYLON from 'babylonjs';

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

export function linterp(start: number, end: number, steps: number, curr: number) {
	return start + (curr / steps) * (end - start);
}

export function vecinterp(start: BABYLON.Vector3, end: BABYLON.Vector3, steps: number, curr: number) {
	let eprop = linterp(0, 1, steps, curr);
	let sprop = 1 - eprop;
	return new BABYLON.Vector3(
		sprop * start.x + eprop * end.x,
		sprop * start.y + eprop * end.y,
		sprop * start.z + eprop * end.z);
}