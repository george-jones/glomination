import * as BABYLON from 'babylonjs';

import * as rand from './rand';
import { Planet, Face } from './planet';
import { Region, randomName } from './countryMaker';
import * as cfg from './gameConfig';
import * as util from './util';

let BAR_WIDTH = 240;

interface PlannedAction {
	action: string;
	source: Region;
	target?: Region;
	num?: number;
	ele?: HTMLElement;
	arrow?: BABYLON.Mesh;
}

interface Player {
	npc: boolean;
	color: number[];
	highlightColor: number[];
	startingPopulationMultiplier: number;
	totalPop: number;
	plannedActions: PlannedAction[];
}

export interface RegionGameData {
	id?: number;
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
	private startedAction: PlannedAction;
	private sourceRegion: Region;
	private lastTargetedRegion: Region;
	private lastPropListener: any;
	private lastClickOkListener: any;
	private lastClickRemoveListener: any;
	private interacting: boolean;

	constructor (planet: Planet, scene: BABYLON.Scene, players: cfg.Player[]) {
		this.planet = planet;
		this.scene = scene;
		this.regions = this.planet.regions;
		this.config = cfg.getConfig();
		this.players = players.map(this.makePlayer);
		this.currentPlayer = 0;

		this.assignRegions();
		this.colorRegions();

		this.planet.show();
		let game = this;
		this.showingActionButtons = false;
		this.lastPropListener = null;
		this.lastClickOkListener = null;
		this.lastClickRemoveListener = null;
		this.interacting = false;

		window.addEventListener('pointerdown', () => {
			if (this.showingActionButtons) {
				return;
			}
			if (!this.interacting) {
				game.mouseDown();
			}
		});

		window.addEventListener('pointerup', () => {
			if (this.showingActionButtons) {
				return;
			}
			if (!this.interacting) {
				this.mouseUp();
			}
		});

		window.addEventListener('pointermove', (evt) => {
			if (this.interacting || this.showingActionButtons) {
				return;
			}
			if (evt.buttons == 0) {
				this.highlightRegion(false);
			}
		});

		document.getElementById('actionEventCatcher').addEventListener('click', () => {
			if (this.interacting) {
				return;
			}
			this.hideActionButtons();
		});

		document.getElementById('attackButton').addEventListener('click', () => {
			this.actionStart('attack');
		});

		document.getElementById('settleButton').addEventListener('click', () => {
			this.actionStart('settle');
		});

		document.getElementById('moveButton').addEventListener('click', () => {
			this.actionStart('move');
		});

		document.getElementById('actionInfo').addEventListener('click', (evt) => {
			if (this.interacting) {
				return;
			}
			// TODO: show action in interact slider
		}); 
	}

	private makePlayer(cp:cfg.Player): Player {
		return {
			npc: cp.npc,
			color: cp.color,
			highlightColor: cp.highlightColor,
			totalPop: 0,
			startingPopulationMultiplier: 0,
			plannedActions: []
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

	private regionIsLegalTarget(region: Region) {
		let curPlayer = this.players[this.currentPlayer];
		if (this.startedAction.action === 'attack') {
			if (region.gameData.owner == curPlayer) {
				return false;
			} else {
				return true;
			}
		} else if (this.startedAction.action === 'move' || this.startedAction.action === 'settle') {
			if (region.gameData.owner == curPlayer) {
				return true;
			} else {
				return false;
			}
		} else {
			// shouldn't happen
			return false;
		}
	}

	private highlightRegion(click: boolean) {
		let pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
		let curPlayer = this.players[this.currentPlayer];
		if (pickResult.pickedMesh == this.planet.sphere) {
			let region = this.planet.faces[pickResult.faceId].region;

//			document.getElementById('sourceCountry').classList.remove('hidden');

			if (this.startedAction) {
				if (region && region != this.startedAction.source && this.lastTargetedRegion != region) {
					this.makeRegionTarget(region);
				} else if (!region || region == this.startedAction.source) {
					this.wipeLastRegionTarget();
				}
			}

			if (click) {
				if (region) {
					if (this.startedAction) {
						if (this.regionIsLegalTarget(region)) {
							this.targetChosen(region);
						} else {
							this.undoAction();
						}
					} else if (region.gameData.owner == curPlayer) {
						// make sure there isn't already an action originating from here
						let found_pa = null;

						this.players[this.currentPlayer].plannedActions.forEach(pa => {
							if (pa.source === region) {
								found_pa = pa;
							}
						});

						if (found_pa) {
							this.showActionInput(found_pa);
						} else {
							this.sourceRegion = region;
							this.lastTargetedRegion = undefined;
							this.showActionButtons();
						}
					}
				} else {
					this.undoAction();
				}
			}
			this.pickRegion(region);
		}
	}
 
	private wipeLastRegionTarget() {
		this.lastTargetedRegion = undefined;
		if (this.startedAction.arrow) {
			this.planet.removeArrow(this.startedAction.arrow);
			this.startedAction.arrow = undefined;
		}
	}

	private makeRegionTarget(r: Region) {
		this.wipeLastRegionTarget();
		this.lastTargetedRegion = r;

		if (this.regionIsLegalTarget(r)) {
			let color: number[] = [ ];

			// see also index.html's "#actionInfo .pa img."" definitions
			if (this.startedAction.action == 'attack') {
				color = [ 0.6, 0, 0 ];
			} else if (this.startedAction.action == 'settle') {
				color = [ 0, 0.6, 0 ];
			} else if (this.startedAction.action == 'move') {
				color = [ 0.66, 0.66, 0 ];
			} else {
				return;
			}

			this.startedAction.arrow =  this.planet.makeRegionsArrow(this.startedAction.source, r, color);
		}
	}

	private actionStart(action: string) {
		let pa: PlannedAction = {
			action: action,
			source: this.sourceRegion
		};
		this.startedAction = pa;
		this.hideActionButtons();

		let paDiv = document.createElement('div');
		paDiv.setAttribute('data-src-idx', '' + pa.source.gameData.id);
		paDiv.className = 'pa';

		pa.ele = paDiv;

		let sourceDiv = document.createElement('div');
		sourceDiv.className = 'source';
		util.elementColorize(sourceDiv, pa.source.gameData.owner.color);
		sourceDiv.innerText = pa.source.gameData.name;

		paDiv.appendChild(sourceDiv);

		let imgFile;
		if (action == 'attack') {
			imgFile = 'blade.png';
		} else if (action == 'settle') {
			imgFile = 'population.png';
		} else if (action == 'move') {
			imgFile = 'shield.png';
		}

		let img = document.createElement('img');
		img.src = 'img/' + imgFile;
		img.className = action; 
		paDiv.appendChild(img);

		let targetDiv = document.createElement('div');
		targetDiv.className = 'target';
		paDiv.appendChild(targetDiv);

		document.getElementById('actionInfo').appendChild(paDiv);
	}

	private undoAction() {
		if (this.startedAction) {
			if (this.startedAction.ele) {
				this.startedAction.ele.parentNode.removeChild(this.startedAction.ele);
			}
			this.finalizeAction();
		}
	}

	// stop showing the current action... move on
	private finalizeAction() {
		this.startedAction = undefined;
		this.lastTargetedRegion = undefined;
		document.getElementById('sourceCountry').classList.add('hidden');
		document.getElementById('targetCountry').classList.add('hidden');
	}

	private targetChosen(target: Region) {
		if (this.startedAction) {
			this.startedAction.target = target;
			let targetDiv = this.startedAction.ele.getElementsByClassName('target')[0] as HTMLElement;
			util.elementColorize(targetDiv, target.gameData.owner.color);
			targetDiv.innerText = target.gameData.name;
			this.players[this.currentPlayer].plannedActions.push(this.startedAction);
			this.showActionInput(this.startedAction);
			this.startedAction = undefined; 
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

		this.regions.forEach((r, idx) => {
			let d: RegionGameData = { };

			r.gameData = d;

			d.id = idx;
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
			let containerId;
			if (this.startedAction && this.startedAction.source != region) {
				containerId = 'targetCountry';
			} else {
				containerId = 'sourceCountry';
			}
			region.setColor(region.gameData.owner.highlightColor);
			this.showCountryInfo(region.gameData, containerId);
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

	private showCountryInfo(d: RegionGameData, elementId: string) {
		let g = (id:string) => document.getElementById(id);
		let c = document.getElementById(elementId);
		let byclass = (className: string) => c.getElementsByClassName(className)[0] as HTMLElement;
		let players = this.players;

		c.classList.remove('hidden');
		let cn = byclass('countryName');
		cn.innerText = d.name; 
		util.elementColorize(cn, d.owner.color);
		byclass('countryPopulation').innerText = this.numstr(d.population);
		byclass('countryMilitary').innerText = this.numstr(d.militarySize);
		byclass('populationFill').style.width = Math.floor(BAR_WIDTH * d.population / d.maximumPopulation) + 'px'; 
 
		let popBar = byclass('countryPopulationBar'); 
		util.domRemoveChildren(popBar); 
	
		let totalLoyalty = d.loyalty.reduce((prev, curr) => prev+curr, 0);
		let sortedLoyalty = d.loyalty.map((val, idx) => {
			return { val: val, player: players[idx] }
		}).sort((a, b) => { return b.val - a.val });

		sortedLoyalty.forEach((o) => {
			let proportion = o.val / totalLoyalty;
			let el;
			if (proportion > 0) {
				let width = Math.round(BAR_WIDTH * proportion);
				el = document.createElement('div');
				el.style.backgroundColor = util.colorArrayToRGB(o.player.color);
				el.style.width = width + 'px';
				popBar.appendChild(el);
			}
		});
	}

	private showActionInput(pa: PlannedAction) {
		let interact = document.getElementById('interact');
		let prop = document.getElementById('actionProportion') as HTMLElement;
		let fill = document.getElementById('actionProportionFill') as HTMLElement;
		let v = document.getElementById('actionValue');
		let okBtn = document.getElementById('okAction');
		let removeBtn = document.getElementById('removeAction');
		let actionSource = document.getElementById('actionSource');
		let actionTarget = document.getElementById('actionTarget');
		let actionLabel = document.getElementById('actionLabel');
		let actionDefault;
		let increments = 20;
		let baseNumber = 0;
		let maxPercent = 100;

		let setPercent = (n: number, t: number) => {
			let minPercent = 100 / increments;
			let percent = minPercent * Math.ceil(increments * n / t);

			if (percent == 0) {
				percent = minPercent;
			} else if (percent > maxPercent) {
				percent = maxPercent;
			}
			fill.style.width = percent + '%';
			pa.num = Math.floor((percent / 100) * baseNumber);
			v.innerHTML = this.numstr(pa.num); 
		}

		let percentFromNum = (n: number) => {
			let percent = Math.round(100 * n / baseNumber);
			fill.style.width = percent + '%';
			v.innerHTML = this.numstr(pa.num);
		};

		util.elementColorize(actionSource, pa.source.gameData.owner.color);
		actionSource.innerHTML = pa.source.gameData.name;
		util.elementColorize(actionTarget, pa.target.gameData.owner.color);
		actionTarget.innerHTML = pa.target.gameData.name;
		actionLabel.className = pa.action;
  
		if (pa.action === 'attack') {
			actionDefault = this.config.actions.attack;
			baseNumber = pa.source.gameData.militarySize;
		} else if (pa.action === 'settle') {
			actionDefault = this.config.actions.settle;
			baseNumber = pa.source.gameData.population;
			maxPercent = Math.min(100, 100 * (pa.target.gameData.maximumPopulation - pa.target.gameData.population) / pa.source.gameData.population);
		} else if (pa.action === 'move') {
			actionDefault = this.config.actions.move;
			baseNumber = pa.source.gameData.militarySize;
		} else {
			console.log('Unrecognized action: ' + pa.action);
			return;
		}

		this.interacting = true;
		interact.classList.add('shown');
		if (pa.num === undefined) {
			setPercent(actionDefault.defaultProportion, 1);
		} else {
			percentFromNum(pa.num);
		}

		// This removing and re-creating of event listeners isn't my usual pattern,
		// but it does have an advantage that the handlers have access to the variables
		// in this function invocation.

		if (this.lastPropListener) {
			prop.removeEventListener('mousemove', this.lastPropListener);
			prop.removeEventListener('mousedown', this.lastPropListener);
		}

		if (this.lastClickOkListener) {
			okBtn.removeEventListener('click', this.lastClickOkListener);
		}

		if (this.lastClickRemoveListener) {
			removeBtn.removeEventListener('click', this.lastClickRemoveListener);
		}

		this.lastPropListener = (evt: MouseEvent) => {
			if (evt.buttons % 2 == 1) {
				setPercent(evt.offsetX, prop.offsetWidth);
			}
		};

		let hideInteract = () => {
			this.interacting = false;
			interact.classList.remove('shown');
		}

		this.lastClickOkListener = (evt: MouseEvent) => {
			// pa.num has already been set, so we just need to ditch the interact box
			hideInteract();
			this.finalizeAction();
		};

		this.lastClickRemoveListener = (evt: MouseEvent) => {
			hideInteract();
			this.finalizeAction();
		};

		prop.addEventListener('mousemove', this.lastPropListener);
		prop.addEventListener('mousedown', this.lastPropListener);
		okBtn.addEventListener('click', this.lastClickOkListener);
		removeBtn.addEventListener('click', this.lastClickRemoveListener);
	}
}  