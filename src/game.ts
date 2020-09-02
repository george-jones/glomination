import * as BABYLON from 'babylonjs';

import * as rand from './rand';
import { Planet, Face } from './planet';
import { Region, randomName } from './countryMaker';
import * as cfg from './gameConfig';

let BAR_WIDTH = 240;

interface Player {
	npc: boolean;
	color: number[];
	highlightColor: number[];
	startingPopulationMultiplier: number;
	totalPop: number;
}

export interface RegionGameData {
	owner?: Player;
	name?: string;
	size?: number;
	maximumPopulation?: number;
	turnsOwned?: number;
	turnsSinceWar?: number;
	population?: number;
	baseDensity?: number;
	militarySize?: number;
	loyalty?: number[];
}

export class Game {
	private planet: Planet;
	private scene: BABYLON.Scene;
	private regions: Region[];
	private pickedRegion: Region;
	private mouseDownFaceId: number;
	private config: cfg.Config;
	private players: Player[];
	private showingActionButtons: boolean;
	private currentPlayer: number;

	constructor (planet: Planet, scene: BABYLON.Scene, players: cfg.Player[]) {
		this.planet = planet;
		this.scene = scene;
		this.regions = this.planet.regions;
		this.config = cfg.getConfig();
		this.players = players.map(this.makePlayer);

		this.assignRegions();
		this.colorRegions();

		this.planet.show();
		let game = this;
		this.showingActionButtons = false;

		window.addEventListener('pointerdown', () => {
			if (this.showingActionButtons) {
				return;
			}
			game.mouseDown();
		});

		window.addEventListener('pointerup', () => {
			if (this.showingActionButtons) {
				return;
			}
			this.mouseUp();
		});

		window.addEventListener('pointermove', (evt) => {
			if (this.showingActionButtons) {
				return;
			}
			if (evt.buttons == 0) {
				this.highlightRegion(false);
			}
		});

		document.getElementById('actionEventCatcher').addEventListener('click', () => {
			this.hideActionButtons();
		});
	}

	private makePlayer(cp:cfg.Player): Player {
		return {
			npc: cp.npc,
			color: cp.color,
			highlightColor: cp.highlightColor,
			totalPop: 0,
			startingPopulationMultiplier: 0
		}
	}

	private mouseDown() {
		let pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
		if (pickResult.pickedMesh == this.planet.sphere) {
			this.mouseDownFaceId = pickResult.faceId;
		}
	}

	private mouseUp() {
		let pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
		if (pickResult.pickedMesh == this.planet.sphere && this.mouseDownFaceId == pickResult.faceId) {
			this.highlightRegion(true);
		}
	}

	private unhighlightRegion() {
		this.pickRegion(null);
	}

	private highlightRegion(click: boolean) {
		let pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
		if (pickResult.pickedMesh == this.planet.sphere) {
			let region = this.planet.faces[pickResult.faceId].region;
			if (click && region) {
				this.showActionButtons();
			}
			this.pickRegion(region);
		}
	}

	private hideActionButtons() {
		let ca = document.getElementById('chooseAction');
		ca.className = '';
		ca.style.top = -1000 + 'px';
		ca.style.left = -1000 + 'px';
		document.getElementById('actionEventCatcher').style.display = 'none';
		this.showingActionButtons = false;
		this.unhighlightRegion();
	}

	private showActionButtons() {
		let btn = document.getElementById('chooseAction');
		btn.style.left = this.scene.pointerX + 'px';
		btn.style.top = this.scene.pointerY + 'px';
		btn.className = 'show';

		document.getElementById('actionEventCatcher').style.display = 'block';
		this.showingActionButtons = true;
	}

	private lerpProportion (proportion: number, low: number, high: number): number {
		return low + proportion * (high - low);
	};

	private regionCalcMaxPop (region: Region) {
		let d = region.gameData;
		let equatorial = this.lerpProportion(1 - Math.abs(region.midPoint.y), this.config.population.polar, this.config.population.equatorial);

		d.maximumPopulation = Math.floor(d.size * d.baseDensity * equatorial);
	};

	private assignRegions() {
		let players = this.players;
		let regionsBySize = this.regions.slice();
		let names = new Set();
		let totalMaxPops: number[] = [ ];

		for (let i=0; i < players.length; i++) {
			totalMaxPops[i] = 0;
		}

		this.regions.forEach(r => {
			let d: RegionGameData = { };

			r.gameData = d;

			d.size = r.faces.length * 24906;
			d.turnsOwned = 0;
			d.turnsSinceWar = -1;
			d.population = 0;
			d.baseDensity = rand.range(this.config.population.lowBaseDensity, this.config.population.highBaseDensity);
			d.militarySize = 0;
			d.loyalty = [ ];
			this.regionCalcMaxPop(r);

			while (true) {
				d.name = randomName();
				if (!names.has(d.name)) {
					names.add(d.name);
					break;
				}
			}
		});

		// largest to smallest
		regionsBySize.sort((a: Region, b: Region): number => {
			return (b.gameData.maximumPopulation - a.gameData.maximumPopulation);
		});

		let findSmallestMaxPopPlayer = ():number => {
			let ownerNum = -1;
			let minPop = 0;

			totalMaxPops.forEach((mpop, idx) => {
				if (idx == 0 || mpop < minPop) {
					ownerNum = idx;
					minPop = mpop;
				}
			});

			return ownerNum;
		}

		regionsBySize.forEach((r) => {
			let d: RegionGameData = r.gameData;
			let ownerNum: number;

			// find owner w/ smallest max pop
			ownerNum = findSmallestMaxPopPlayer();
			d.owner = players[ownerNum];
			totalMaxPops[ownerNum] += d.maximumPopulation;
		});

		console.log(totalMaxPops);

		// make every player start w/ the same initial total population by multiplying
		// initial populations by a factor that depends on the totals.
		let minTotalPop = -1;

		totalMaxPops.forEach(function (mp) {
			if (minTotalPop == -1 || mp < minTotalPop) {
				minTotalPop = mp;
			}
		});

		players.forEach((p, i) => {
			p.startingPopulationMultiplier = this.config.population.initialMax * minTotalPop / totalMaxPops[i];
			p.totalPop = 0;
			console.log(p.startingPopulationMultiplier);
		});

		regionsBySize.forEach((r) => {
			let d = r.gameData;

			d.population = Math.floor(d.maximumPopulation * d.owner.startingPopulationMultiplier);
			d.owner.totalPop += d.population;
			
			// initialize loyalty numbers
			let n = players.length;
			for (let i=0; i < n; i++) {
				if (players[i] == d.owner) {
					d.loyalty[i] = this.config.loyalty.ownerInitial;
				} else {
					d.loyalty[i] = this.config.loyalty.othersInitial / (n-1);
				}
			}

			d.militarySize = Math.floor(this.config.population.initialMilitary * d.population);
			r.gameData = d;
		});
	}

	private pickRegion(region: Region) {
		let pr = this.pickedRegion;
		if (pr && pr != region) {
			pr.setColor(pr.gameData.owner.color);
		}

		if (region && region != pr) {
			region.setColor(region.gameData.owner.highlightColor);
			this.showCountryInfo(region.gameData);
		}
		this.pickedRegion = region;
		
		this.planet.reColorAll();
	}

	private colorRegions() {
		this.regions.forEach((r) => {
			r.setColor(r.gameData.owner.color);
		});

		this.planet.reColorAll();
	}

	private numstr(n: number) {
		return n.toLocaleString(undefined);
	}

	private showCountryInfo(d: RegionGameData) {
		let g = (id:string) => document.getElementById(id);

		g('countryInfo').className = 'show';
		g('countryName').innerText = d.name;
		g('countryPopulation').innerText = this.numstr(d.population);
		g('countryMilitary').innerText = this.numstr(d.militarySize);
		g('populationFill').style.width = Math.floor(BAR_WIDTH * d.population / d.maximumPopulation) + 'px'; 
 
		/*
		let popBar = g('countryPopulationBar');
		popBar.setAttribute('value', '' + d.population);
		popBar.setAttribute('max', '' + d.maximumPopulation); 
		*/
	}
}
