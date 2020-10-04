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
	neighborGrowthFactor: number;
}

interface Action {
	defaultProportion: number;
	color?: number[];
}

interface AttackAction extends Action {
	minAttackEffect: number;
	maxAttackEffect: number;
	attackerLuck: number;
	minDefendEffect: number;
	maxDefendEffect: number;
	defenderLuck: number;
	civilianCasualtyFactor: number;
}

export interface Config {
	population: Population;
	loyalty: Loyalty;
	military: Military;
	actions: {
		attack: AttackAction;
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
			growthFactor: 0.1,
			neighborGrowthFactor: 0.02
		},
		actions: {
			attack: {
				defaultProportion: 0.33,
				minAttackEffect: 0.5,
				maxAttackEffect: 1.0,
				attackerLuck: 0.1,
				minDefendEffect: 0.5,
				maxDefendEffect: 1.0,
				defenderLuck: 0.1,
				civilianCasualtyFactor: 1.0
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