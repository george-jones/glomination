export interface Player {
	npc: boolean;
	color: number[];
	highlightColor: number[];
}

interface Population {
	lowBaseDensity: number;
	highBaseDensity: number;
	polar: number;
	equatorial: number;
	disloyalGrowth: number;
	loyalGrowth: number;
	initialMax: number;
	initialMilitary: number;
}

interface Loyalty {
	ownerInitial: number;
}

interface Action {
	defaultProportion: number;
	color?: number[];
}

export interface Config {
	population: Population;
	loyalty: Loyalty;
	actions: {
		attack: Action;
		settle: Action;
		move: Action;
	}
}

export function getConfig () : Config {
	return {
		population: {
			lowBaseDensity: 80,
			highBaseDensity: 270,
			polar: 0.15,
			equatorial: 1.0,
			disloyalGrowth: 0.10,
			loyalGrowth: 1.0,
			initialMax: 0.4,
			initialMilitary: 0.0037
		},
		loyalty: {
			ownerInitial: 0.6
		},
		actions: {
			attack: {
				defaultProportion: 0.33
			},
			settle: {
				defaultProportion: 0.2
			},
			move: {
				defaultProportion: 0.33
			}
		}
	}
}