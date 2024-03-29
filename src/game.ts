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
	id?: number;
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

		document.getElementById('settleButton').addEventListener('click', () => {
			this.actionStart('settle');
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
			let initLoyal = this.config.loyalty.ownerInitial;
			for (let i=0; i < n; i++) {
				if (players[i] == d.owner) {
					d.loyalty[i] = initLoyal;
				} else {
					d.loyalty[i] = (1 - initLoyal) / (n-1);
				}
			}

			d.militarySize = Math.floor(this.config.military.initialMilitary * d.population);
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
		let totalPixels = 0;
		let widthDeficit = 0;
		let firstDiv: HTMLElement = null;
		let firstWidth = 0;

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
				let width = Math.floor(Math.floor(100 * BAR_WIDTH * proportion) / 100);
				el = document.createElement('div');
				el.style.backgroundColor = util.colorArrayToRGB(o.player.color);
				el.style.width = width + 'px';
				totalPixels += width;
				popBar.appendChild(el);

				if (firstWidth == 0) {
					firstWidth = width;
					firstDiv = el;
				}
			}
		});

		widthDeficit = popBar.clientWidth - totalPixels;
		if (widthDeficit != 0) {
			firstDiv.style.width = (firstWidth + widthDeficit) + 'px';
		}
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
		let settleByRegion = new Map<number, PlannedAction[]>();
		let attacksByRegion = new Map<number, PlannedAction[]>();

		// TODO: a small matter of implementing NPC decisions

		this.players.forEach(p => {
			p.plannedActions.forEach(a => {
				let id = a.target.gameData.id;

				if (a.action == 'move') {
					moveActions.push(a);
				} else if (a.action == 'settle') {
					let settlings: PlannedAction[];

					if (settleByRegion.has(id)) {
						settlings = settleByRegion.get(id);
					} else {
						settlings = [ ];
						settleByRegion.set(id, settlings);
					}

					settlings.push(a);
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
			const sIndices: number[] = Array.from(settleByRegion.keys());
			util.asyncEach(sIndices, (idx:number, cb:Function) => {
				let settlings = settleByRegion.get(idx);
				game.settleActions(settlings, advance, cb);
			}, () => {
				const aIndices: number[] = Array.from(attacksByRegion.keys());
				util.asyncEach(aIndices, (idx:number, cb:Function) => {
					let attacks = attacksByRegion.get(idx);
					game.attackActions(attacks, advance, cb);
				}, () => {
					// all done
					game.players.forEach(p => {
						p.plannedActions = [ ];
					});

					game.regionsGrowPopulation();
					game.regionsGrowMilitary();

					btn.classList.remove('disabled');
				});
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

	private settleActions(actions: PlannedAction[], advanceCb: Function, doneCb: Function) {
		let game = this;
		let totalAdding = 0;
		let newPop = 0;
		let targetData = actions[0].target.gameData;
		let proportion = 1.0;
		let loyaltyTotals: number[] = [ ];
		let loyaltyGrandTotal = 0;

		actions.forEach(a => {
			totalAdding += a.num;
		});

		game.players.forEach(p => {
			loyaltyTotals.push(0);
		});

		newPop = totalAdding + targetData.population;
		if (newPop > 0) {
			if (newPop > targetData.maximumPopulation) {
				proportion = (targetData.maximumPopulation - targetData.population) / totalAdding;
				newPop = targetData.maximumPopulation;
			}

			// start w/ the original loyalty numbers
			targetData.loyalty.forEach((n, idx) => {
				//targetData.loyalty(n);
				let num = targetData.population * n;
				loyaltyTotals[idx] += num;
				loyaltyGrandTotal += num;
			});

			// add in the loyalty of all the settlers
			actions.forEach((a) => {
				a.source.gameData.loyalty.forEach((n, idx) => {
					let num = proportion * a.num * n;
					loyaltyTotals[idx] += num;
					loyaltyGrandTotal += num;
				});
			});

			// set loyalty proportions
			targetData.loyalty = targetData.loyalty.map((n, idx) => {
				return loyaltyTotals[idx] / loyaltyGrandTotal;
			});

			// set new populations
			targetData.population = newPop;
			actions.forEach((a) => {
				a.source.gameData.population -= Math.floor(proportion * a.num);
			});
		}

		// clear
		util.asyncEach(actions, (a: PlannedAction, nextCb: Function) => {
			game.removeActionFromList(a);
			advanceCb(a, nextCb);
		}, () => {
			doneCb();
		});
	}

	private processSingleConflict(a:PlannedAction) {
		let c = this.config.actions.attack;
		let d = a.target.gameData;
		let dist = 0;
		let eff_attacker = 0;
		let eff_defender = 0;
		let force_attacker = 0;
		let force_defender = 0;
		let luck = 0;
		let diff = 0;
		let defender_remaining = 0;
		let attacker_remaining = 0;
		let attacker_num = 0;
		let defender_num = 0;

		attacker_num = a.num;
		defender_num = d.militarySize;

		// attacker effectiveness goes down with distance
		dist = a.source.midPoint.subtract(a.target.midPoint).length();
		eff_attacker = c.minAttackEffect;
		eff_attacker += Math.max((2 - dist)/2, 0) * (c.maxAttackEffect - c.minAttackEffect);

		// defender effectiveness depends on relative population loyaly
		eff_defender = c.minDefendEffect;
		if (d.population > 0) {
			eff_defender += (c.maxDefendEffect - c.minAttackEffect) * this.regionGetLoyalPop(d) / d.population; 
		}

		force_attacker = attacker_num * eff_attacker;
		force_defender = defender_num * eff_defender;
		luck = rand.gaussianRange(-1 * c.attackerLuck, c.defenderLuck);
		if (luck < 0) {
			force_attacker *= 1 - luck;
		} else {
			force_defender *= 1 + luck;
		}

		diff = force_defender - force_attacker;
		
		if (diff < 0) {
			defender_remaining = 0;
			attacker_remaining = Math.ceil(attacker_num * -1 * diff / force_attacker);
		} else {
			attacker_remaining = 0
			defender_remaining = Math.ceil(defender_num * diff / force_defender)
		}

		return {
			attacker_remaining,
			defender_remaining
		}
	}

	private attackActions(actions: PlannedAction[], advanceCb: Function, doneCb: Function) {
		let game = this;

		util.asyncEach(actions, (a: PlannedAction, nextCb: Function) => {
			let d = a.target.gameData;
			let result = game.processSingleConflict(a);
			let civKilled = game.config.actions.attack.civilianCasualtyFactor * (d.militarySize - result.defender_remaining);
			let civRemaining = Math.max(0, d.population - civKilled);

			a.source.gameData.militarySize -= a.num;

			d.population = civRemaining;

			if (result.defender_remaining > 0) {
				d.militarySize = result.defender_remaining;
			} else {
				// attacker took control of region
				d.militarySize = result.attacker_remaining;
				d.owner = a.source.gameData.owner;
				a.target.setColor(d.owner.color);
				game.planet.reColorAll();
			}

			game.removeActionFromList(a);
			advanceCb(a, nextCb);
		}, () => {
			doneCb();
		});
	}

	private regionGetLoyalPop(d: RegionGameData) {
		return d.population * d.loyalty[d.owner.id];
	}

	private regionsGrowPopulation() {
		let g = this.config.population.loyalGrowth;

		this.regions.forEach((r:Region) => {
			let d = r.gameData;
			let playerIndex = d.owner.id;
			let loyalPop = this.regionGetLoyalPop(d);
			let addPop = Math.floor(loyalPop * g);

			if (addPop + d.population > d.maximumPopulation) {
				addPop = d.maximumPopulation - d.population;
			}

			let newLoyalPop = loyalPop + addPop;
			let newTotalPop = d.population + addPop;

			d.loyalty = d.loyalty.map((proportion, idx) => {
				if (idx == playerIndex) {
					return newLoyalPop / newTotalPop;
				} else {
					return (proportion * d.population) / newTotalPop;
				}
			});

			d.population = newTotalPop;
		}, this);

	}

	private regionsGrowMilitary() {
		this.regions.forEach((r:Region) => {
			let d = r.gameData;
			let loyalPop = this.regionGetLoyalPop(d);
			let growth = loyalPop * this.config.military.initialMilitary * this.config.military.growthFactor;

			r.neighbors.forEach(n => {
				let nd = n.gameData;
				if (nd.owner == d.owner) {
					growth += this.regionGetLoyalPop(nd) * this.config.military.initialMilitary * this.config.military.neighborGrowthFactor;
				}
			}, this);

			d.militarySize += Math.ceil(growth);
		});
	}
}