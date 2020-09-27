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
	loyalGrowth: number;
	initialMax: number;
}

interface Loyalty {
	ownerInitial: number;
}

interface Military {
	initialMilitary: number;
	growthFactor: number;
}

interface Action {
	defaultProportion: number;
	color?: number[];
}

export interface Config {
	population: Population;
	loyalty: Loyalty;
	military: Military;
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
			loyalGrowth: 0.3,
			initialMax: 0.4
		},
		loyalty: {
			ownerInitial: 0.6
		},
		military: {
			initialMilitary: 0.0037,
			growthFactor: 0.1
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