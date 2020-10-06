export interface Player {
	npc: boolean;
	color: number[];
	highlightColor: number[];
}

interface Productivity {
	lowBaseDensity: number;
	highBaseDensity: number;
	polar: number;
	equatorial: number;
}

interface Military {
	initialMilitary: number;
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
	defendEffect: number;
	defenderLuck: number;
}

export interface Config {
	productivity: Productivity;
	military: Military;
	actions: {
		attack: AttackAction;
		move: Action;
	}
}

export function getConfig () : Config {
	return {
		productivity: {
			lowBaseDensity: 0.01,
			highBaseDensity: 0.03,
			polar: 0.15,
			equatorial: 1.0
		},
		military: {
			initialMilitary: 5,
			neighborGrowthFactor: 0.2
		},
		actions: {
			attack: {
				defaultProportion: 0.33,
				minAttackEffect: 0.5,
				maxAttackEffect: 1.0,
				attackerLuck: 0.1,
				defendEffect	: 1.0,
				defenderLuck: 0.1,
			},
			move: {
				defaultProportion: 0.33
			}
		}
	}
}