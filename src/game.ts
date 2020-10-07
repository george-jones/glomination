import * as BABYLON from 'babylonjs';

import * as rand from './rand';
import { Planet, Face } from './planet';
import { Region, randomName } from './countryMaker';
import * as cfg from './gameConfig';
import * as util from './util';

interface PlannedAction {
	action: string;
	source: Region;
	target?: Region;
	num?: number;
	ele?: HTMLElement;
	arrow?: BABYLON.Mesh;
}

interface Player {
	id?: number;
	npc: boolean;
	color: number[];
	highlightColor: number[];
	startingProductionMultiplier: number;
	totalProduction: number;
	plannedActions: PlannedAction[];
}

interface Combatant {
	player: Player;
	nums?: number[];
	effs?: number[];
	num?: number;
	eff?: number;
}

export interface RegionGameData {
	id?: number;
	owner?: Player;
	name?: string;
	size?: number;
	turnsOwned?: number;
	turnsSinceWar?: number;
	production?: number;
	baseDensity?: number;
	militarySize?: number;
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
	private executingActions: boolean;

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
		this.executingActions = false;

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

		document.getElementById('moveButton').addEventListener('click', () => {
			this.actionStart('move');
		});

		document.getElementById('goButton').addEventListener('click', (evt) => {
			this.go();
		}); 
	}

	private makePlayer(cp:cfg.Player, id:number): Player {
		return {
			id: id,
			npc: cp.npc,
			color: cp.color,
			highlightColor: cp.highlightColor,
			totalProduction: 0,
			startingProductionMultiplier: 0,
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
		} else if (this.startedAction.action === 'move') {
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

		paDiv.addEventListener('click', (evt) => {
			let moveTo;
			if (evt.target === sourceDiv) {
				moveTo = pa.source.midPoint;
			} else if (evt.target === targetDiv) {
				moveTo = pa.target.midPoint;
			} else if (pa.source && pa.target) {
				this.showActionInput(pa);
			}

			if (moveTo) {
				let framesPerKey = 2;
				let startPos = this.scene.activeCamera.position;
				let endPos = moveTo.scale(startPos.length());
				let translate = new BABYLON.Animation("camTranslate", "position", 60, BABYLON.Animation.ANIMATIONTYPE_VECTOR3, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
				let path = util.findGlobePath(startPos, endPos);
				let t = -1 * framesPerKey;
				let keys = path.map((p) => {
					t += framesPerKey;
					return { frame: t, value: p };
				});
				
				// Creating an easing function
				let easingFunction = new BABYLON.SineEase();

				// For each easing function, you can choose between EASEIN (default), EASEOUT, EASEINOUT
				easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

				// Adding the easing function to the animation
				translate.setEasingFunction(easingFunction);

				translate.setKeys(keys);
				this.scene.activeCamera.animations.push(translate);
				this.scene.beginAnimation(this.scene.activeCamera, 0, 5000, false, 1.0, () => {
					let cam = this.scene.activeCamera as BABYLON.ArcRotateCamera;
					cam.setMatUp(); // maybe
				});
			}
		});

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

	private regionCalcProduction (region: Region) {
		let d = region.gameData;
		let equatorial = this.lerpProportion(1 - Math.abs(region.midPoint.y), this.config.productivity.polar, this.config.productivity.equatorial);

		d.production = Math.floor(d.size * d.baseDensity * equatorial);
	};

	private assignRegions() {
		let players = this.players;
		let regionsBySize = this.regions.slice();
		let names = new Set();
		let totalProductions: number[] = [ ];

		for (let i=0; i < players.length; i++) {
			totalProductions[i] = 0;
		}

		this.regions.forEach((r, idx) => {
			let d: RegionGameData = { };

			r.gameData = d;

			d.id = idx;
			d.size = r.faces.length * 24906;
			d.turnsOwned = 0;
			d.turnsSinceWar = -1;
			d.production = 0;
			d.baseDensity = rand.range(this.config.productivity.lowBaseDensity, this.config.productivity.highBaseDensity);
			d.militarySize = 0;
			this.regionCalcProduction(r);

			while (true) {
				d.name = randomName();
				if (!names.has(d.name)) {
					names.add(d.name);
					break;
				}
			}
		});

		// most productive to least
		regionsBySize.sort((a: Region, b: Region): number => {
			return (b.gameData.production - a.gameData.production);
		});

		let findSmallestProductionPlayer = ():number => {
			let ownerNum = -1;
			let minProd = 0;

			totalProductions.forEach((prod, idx) => {
				if (idx == 0 || prod < minProd) {
					ownerNum = idx;
					minProd = prod;
				}
			});

			return ownerNum;
		}

		regionsBySize.forEach((r) => {
			let d: RegionGameData = r.gameData;
			let ownerNum: number;

			// find owner w/ smallest max production
			ownerNum = findSmallestProductionPlayer();
			d.owner = players[ownerNum];
			totalProductions[ownerNum] += d.production;
		});

		// make every player start w/ the same initial total production by multiplying
		// initial productions by a factor that depends on the totals.
		let minTotalProd = -1;

		totalProductions.forEach(function (mp) {
			if (minTotalProd == -1 || mp < minTotalProd) {
				minTotalProd = mp;
			}
		});

		players.forEach((p, i) => {
			p.startingProductionMultiplier = minTotalProd / totalProductions[i];
			p.totalProduction = 0;
		});

		regionsBySize.forEach((r) => {
			let d = r.gameData;

			d.production = Math.floor(d.production * d.owner.startingProductionMultiplier);
			d.owner.totalProduction += d.production;

			d.militarySize = Math.floor(this.config.military.initialMilitary * d.production);
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
			this.showCountryInfo(region, containerId);
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

	private getNeighborsProductionBonus(r: Region): number {
		let owner = r.gameData.owner;
		let bonus = 0;

		r.neighbors.forEach(n => {
			let nd = n.gameData;
			if (nd.owner == owner) {
				bonus += nd.production * this.config.military.neighborGrowthFactor;
			}
		}, this);

		return Math.ceil(bonus);
	}

	private showCountryInfo(r: Region, elementId: string) {
		let d = r.gameData;
		let g = (id:string) => document.getElementById(id);
		let c = document.getElementById(elementId);
		let byclass = (className: string) => c.getElementsByClassName(className)[0] as HTMLElement;
		let prodStr;
		let bonus = 0;

		c.classList.remove('hidden');
		let cn = byclass('countryName');
		cn.innerText = d.name; 
		util.elementColorize(cn, d.owner.color);

		prodStr = this.numstr(d.production);
		bonus = this.getNeighborsProductionBonus(r);
		if (bonus > 0) {
			prodStr += ' + ' + this.numstr(bonus);
		}

		byclass('countryMilitary').innerText = this.numstr(d.militarySize);
		byclass('countryProduction').innerText = prodStr;
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
			let playerActions = this.players[this.currentPlayer].plannedActions;
			let idx = playerActions.indexOf(pa);
			playerActions.splice(idx, 1);
			pa.ele.remove();
			this.planet.removeArrow(pa.arrow);
			hideInteract();

			this.finalizeAction();
		};

		prop.addEventListener('mousemove', this.lastPropListener);
		prop.addEventListener('mousedown', this.lastPropListener);
		okBtn.addEventListener('click', this.lastClickOkListener);
		removeBtn.addEventListener('click', this.lastClickRemoveListener);
	}

	private go() {
		let btn = document.getElementById('goButton');
		let game = this;

		btn.classList.add('disabled');

		let moveActions: PlannedAction[] = [ ];
		let attacksByRegion = new Map<number, PlannedAction[]>();

		// TODO: a small matter of implementing NPC decisions

		this.players.forEach(p => {
			p.plannedActions.forEach(a => {
				let id = a.target.gameData.id;

				if (a.action == 'move') {
					moveActions.push(a);
				} else if (a.action == 'attack') {
					let attacks: PlannedAction[];

					if (attacksByRegion.has(id)) {
						attacks = attacksByRegion.get(id);
					} else {
						attacks = [ ];
						attacksByRegion.set(id, attacks);
					}

					attacks.push(a);
				}
			});
		});

		let advance = (a:PlannedAction, cb:Function) => {
			if (a.source.gameData.owner == game.players[game.currentPlayer]) {
				window.setTimeout(cb, 100);
			} else {
				cb();
			}
		}

		util.asyncEach(moveActions, (a:PlannedAction, cb:Function) => {
			game.moveAction(a);
			advance(a, cb);
		}, function () {
			const aIndices: number[] = Array.from(attacksByRegion.keys());
			util.asyncEach(aIndices, (idx:number, cb:Function) => {
				let attacks = attacksByRegion.get(idx);
				game.attackActions(attacks, advance, cb);
			}, () => {
				// all done
				game.players.forEach(p => {
					p.plannedActions = [ ];
				});

				game.regionsGrowMilitary();

				btn.classList.remove('disabled');
			});
		});
	}

	private removeActionFromList(a: PlannedAction) {
		if (a.ele) {
			a.ele.remove();
		}
		if (a.arrow) {
			this.planet.removeArrow(a.arrow);
		}
	}

	private moveAction(a: PlannedAction) {
		a.source.gameData.militarySize -= a.num;
		a.target.gameData.militarySize += a.num;
		this.removeActionFromList(a);
	}

	private processSingleConflict(conflict: Combatant[]): Combatant {
		let c = this.config.actions.attack;
		let eff_1 = 0;
		let eff_2 = 0;
		let force_1 = 0;
		let force_2 = 0;
		let luck = 0;
		let diff = 0;
		let num_1 = 0;
		let num_2 = 0;

		num_1 = conflict[0].num;
		num_2 = conflict[1].num;

		// attacker effectiveness goes down with distance
		eff_1 = conflict[0].eff;

		// defender effectiveness is a constant
		eff_2 = conflict[1].eff;
		force_1 = num_1 * eff_1;
		force_2 = num_2 * eff_2;
		luck = rand.gaussianRange(-1 * c.luck, c.luck);
		if (luck < 0) {
			force_1 *= 1 - luck;
		} else {
			force_2 *= 1 + luck;
		}

		diff = force_2 - force_1;
		
		if (diff < 0) {
			conflict[0].num = Math.ceil(num_1 * -1 * diff / force_1);
			return conflict[0];
		} else {
			conflict[1].num = Math.ceil(num_2 * diff / force_2)
			return conflict[1];
		}
	}

	private doWar(cbts: Combatant[]): Combatant[]
	{
		let conflicts: Combatant[][] = [ ];
		let divMap = new Map<Player, number>();

		cbts.forEach(cbt => {
			divMap.set(cbt.player, 0);
		});

		// make mini-conflicts between all combatants
		cbts.forEach(cbt => {
			cbts.forEach(cbt2 => {
				if (cbt.player.id < cbt2.player.id) {
					divMap.set(cbt.player, divMap.get(cbt.player) + 1);
					divMap.set(cbt2.player, divMap.get(cbt2.player) + 1);
					conflicts.push([ {...cbt}, {...cbt2} ]);
				}
			});
		});

		// reduce numbers in each mini-conflict
		conflicts.forEach(c => {
			c[0].num /= divMap.get(c[0].player);
			c[1].num /= divMap.get(c[1].player);
		});

		// squash all conflicts back into single combatant records
		let result = conflicts.map(conflict => this.processSingleConflict(conflict));
		let survivors: Combatant[] = [ ];
		result.forEach(cbt => {
			let s = survivors.find((s) => s.player == cbt.player);
			if (s) {
				s.num += cbt.num;
			} else {
				survivors.push(cbt);
			}
		});

		if (survivors.length > 1) {
			return this.doWar(survivors);
		} else {
			return survivors;
		}
	}

	private attackActions(actions: PlannedAction[], advanceCb: Function, doneCb: Function) {
		let game = this;
		let target = actions[0].target;
		let combatants: Combatant[] = [ ];

		// from all attacking actions, make combatant records
		actions.forEach(a => {
			let attacker = a.source.gameData.owner;
			let defender = a.target.gameData.owner;
			let idx;
			let cbt:Combatant;
			let conf = this.config.actions.attack;

			// only add defender combatant once
			idx = combatants.findIndex((c) => c.player == defender);
			if (idx == -1) {
				cbt = {
					player: defender,
					num: a.target.gameData.militarySize,
					eff: this.config.actions.attack.defendEffect // defender effectiveness is a constant
				};
				combatants.push(cbt);
			}

			// make or find and add to attacker combatant
			idx = combatants.findIndex((c) => c.player == attacker);
			let dist = a.source.midPoint.subtract(a.target.midPoint).length();
			let eff_attacker = conf.minAttackEffect;
			eff_attacker += Math.max((2 - dist)/2, 0) * (conf.maxAttackEffect - conf.minAttackEffect);
			if (idx == -1) {
				cbt = {
					player: attacker,
					nums: [ ],
					effs: [ ]
				}
				combatants.push(cbt);
			} else {
				cbt = combatants[idx];
			}
			cbt.nums.push(a.num);
			cbt.effs.push(eff_attacker);
		}, this);

		// combine combatant numbers
		combatants.forEach(cbt => {
			if (cbt.nums) {
				let total_eff = 0;
				cbt.num = cbt.nums.reduce((prev, curr) => prev + curr, 0);
				total_eff = cbt.effs.reduce((prev, curr, idx) => prev + cbt.nums[idx] * curr, 0);
				cbt.eff = total_eff / cbt.num;
			}
		});

		let winner = this.doWar(combatants);
		let d = target.gameData;
		d.owner = winner[0].player;
		d.militarySize = winner[0].num;
		target.setColor(d.owner.color);
		game.planet.reColorAll();

		util.asyncEach(actions, (a: PlannedAction, nextCb: Function) => {
			game.removeActionFromList(a);
			advanceCb(a, nextCb);
		}, () => {
			doneCb();
		});
	}

	private regionsGrowMilitary() {
		this.regions.forEach((r:Region) => {
			let d = r.gameData;
			let growth = r.gameData.production;

			growth += this.getNeighborsProductionBonus(r);
			d.militarySize += growth;
		}, this);
	}
}