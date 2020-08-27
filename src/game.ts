import * as BABYLON from 'babylonjs';

import * as rand from './rand';
import { Planet, Face } from './planet';
import { Region, randomName } from './countryMaker';
import * as cfg from './gameConfig';

export interface RegionGameData {
	owner?: cfg.Player;
	name?: string;
}

export class Game {
	private planet: Planet;
	private scene: BABYLON.Scene;
	private regions: Region[];
	private pickedRegion: Region;
	private mouseDownFaceId: number;
	private config: cfg.Config;
	private players: cfg.Player[];
	private showingActionButtons: boolean;

	constructor (planet: Planet, scene: BABYLON.Scene, players: cfg.Player[]) {
		this.planet = planet;
		this.scene = scene;
		this.regions = this.planet.regions;
		this.config = cfg.getConfig();
		this.players = players;

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
			if (click) {
				this.showActionButtons();
			}
			this.pickRegion(region);
		}
	}

	private hideActionButtons() {
		document.getElementById('chooseAction').className = '';
		document.getElementById('actionEventCatcher').style.display = 'none';
		this.showingActionButtons = false;
	}

	private showActionButtons() {
		var btn = document.getElementById('chooseAction');
		btn.style.left = this.scene.pointerX + 'px';
		btn.style.top = this.scene.pointerY + 'px';
		btn.className = 'show';

		document.getElementById('actionEventCatcher').style.display = 'block';
		this.showingActionButtons = true;
	}

	private assignRegions() {
		let players = this.players;
		let regionsBySize = this.regions.slice();
		let names = new Set();

		// largest to smallest
		regionsBySize.sort((a: Region, b: Region): number => {
			return (b.faces.length - a.faces.length);
		});

		regionsBySize.forEach((r, idx) => {
			let gd: RegionGameData = { };

			while (true) {
				gd.name = randomName();
				if (!names.has(gd.name)) {
					names.add(gd.name);
					break;
				}
			}
			gd.owner = players[idx % players.length];

			r.gameData = gd;
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
		this.regions.forEach((r, idx) => {
			r.setColor(r.gameData.owner.color);
		});

		this.planet.reColorAll();
	}

	private showCountryInfo(gd: RegionGameData) {
		window.document.getElementById('countryName').innerText = gd.name;
	}
}
