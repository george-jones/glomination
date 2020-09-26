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

export function findGlobePath(start: BABYLON.Vector3, end: BABYLON.Vector3): BABYLON.Vector3[] {
	// find midpoint
	let path: BABYLON.Vector3[ ] = [ ];
	let mp = end.add(start);
	let elevation = start.length();
	let segMax = 50;

	//path.push(start);

	// in the unlikely event that they chose two countries whose midpoint
	// is the exact center of the planet, choose a different midpoint at random.
	if (mp.x == 0 && mp.y == 0 && mp.z == 0) {
		mp.x = Math.random();
		mp.y = Math.random();
		mp.z = Math.random();
	}

	let groundMp = mp.normalize();
	// push midpoint just above surface of planet
	mp = groundMp.scale(elevation);

	let sp = start.normalizeToNew();
	let tp = end.normalizeToNew();

	// Two maximally distant points on a unit sphere are 2 apart.
	let numSegs = Math.ceil(segMax * (tp.subtract(sp).length() / 2));
	// Force numSegs to be even so that we have a definite midpoint
	if (numSegs % 2 == 1) {
		numSegs++;
	}
	let prevGroundPos;

	for (let i=0; i < numSegs; i++) {
		let groundPos;
		let tang;

		if (i < numSegs / 2) {
			groundPos = vecinterp(sp, groundMp, numSegs/2, i).normalize();
			tang = groundMp.subtract(groundPos).normalize();
		} else {
			groundPos = vecinterp(groundMp, tp, numSegs/2, i - numSegs/2).normalize();
			tang = tp.subtract(groundPos).normalize();
			prevGroundPos = groundPos;
		}

		path.push(groundPos.scale(elevation));
	}

	path.push(end);

	return path;
}

export function asyncEach(a: any[], f: Function, done:Function) {
	let idx = -1;

	let recur = () => {
		idx++;
		if (idx < a.length) {
			f(a[idx], recur);
		} else {
			done();
		}
	}

	recur();
}