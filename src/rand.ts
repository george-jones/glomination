
// choose a random array element.  Returns [ element, index ]
export function pick (a:any[]) {
	let idx;
	let el;

	idx = Math.floor(Math.random() * a.length);
	el = a[idx];

	return [el, idx];
};

// make shuffled copy of array
export function shuffle (a:any[]) {
	let dupe = a.slice(); // copies array
	let ret = [ ];
	let picked;

	while (dupe.length > 0) {
		picked = pick(dupe);
		dupe.splice(picked[1], 1);
		ret.push(picked[0]);
	}

	return ret;
};

// choose N random array elements.  Returns [ el1, el2, ... elN ]
export function pickN (a:any[], n:number) {
	let i = 0;
	let j = 0;
	let picked;
	let ret = [ ];
	let dupe = false;

	for (i=0; i < n; i++) {
		dupe = false;
		picked = pick(a);
		for (j=0; j < ret.length; j++) {
			if (ret[j] == picked[0]) {
				dupe = true;
				break;
			}
		}
		if (dupe) {
			i--;
		} else {
			ret.push(picked[0]);
		}
	}
	
	return ret;
};

// given a list of objects, each with a relative 'weight' property, returns
// a function that when called, returns one of the objects at random, but
// based on that weighting.
export function weightedListPicker (a:{ weight: number }[]) : () => any {
	let i;
	let total_w = 0.0;
	let w;
	let items: any[] = [ ];
	let item;
	let curr_total = 0.0;
	let ret;

	// sum weights
	for (i=0; i < a.length; i++) {
		total_w += a[i].weight;
	}

	// make list of items, with a scaled w property that is increasing
	for (i=0; i < a.length; i++) {
		w = a[i].weight / total_w;
		curr_total += w;
		item = { "w": curr_total, "element": a[i] };
		items.push(item);
	}

	ret = function () {
		let v;
		let j;

		if (items.length == 0) {
			return null;
		}

		v = Math.random();
		for (j=0; j < items.length; j++) {
			if (items[j].w >= v) {
				return items[j].element;
			}
		}

		// we shouldn't get here, but if we do... just pick one
		return pick(items)[0].element;
	};

	return ret;
};

// returns a number between low and high
export function rangeInt (low:number, high:number): number {
	return low + Math.floor((1 + high - low) * Math.random());
};

// Get a number from [low,high)
export function range (low:number, high:number): number {
	return low + (high-low) * Math.random();
};

// https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
export function gaussian (): number {
	var u = 0, v = 0;
	while (u === 0) {
		u = Math.random(); //Converting [0,1) to (0,1)
	}
	while (v === 0) {
		v = Math.random();
	}
	return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

export function gaussianRange (low: number, high: number): number {
	var mid = (low + high) / 2;
	var s = (high - low) / 6; // force range to fit w/in +/-3 stdev's
	var g = gaussian();

	g *= s;
	g += mid;

	if (g < low) {
		return low;
	} else if (g > high) {
		return high;
	} else {
		return g;
	}
};