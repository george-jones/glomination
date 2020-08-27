import * as BABYLON from 'babylonjs';

import * as rand from './rand';
import { Planet, Face } from './planet';
import { Region } from './countryMaker';
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

		window.addEventListener('pointerdown', () => {
			game.mouseDown();
		});

		window.addEventListener('pointerup', () => {
			this.mouseUp();
		});

		window.addEventListener('pointermove', (evt) => {
			if (evt.buttons == 0) {
				this.highlightRegion();
			}
		});
	}

	private mouseDown() {
		this.unhighlightRegion();
		let pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
		if (pickResult.pickedMesh == this.planet.sphere) {
			this.mouseDownFaceId = pickResult.faceId;
		}
	}

	private mouseUp() {
		let pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
		if (pickResult.pickedMesh == this.planet.sphere && this.mouseDownFaceId == pickResult.faceId) {
			this.highlightRegion();
		}
	}

	private unhighlightRegion() {
		this.pickRegion(null);
	}

	private highlightRegion() {
		let pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
		if (pickResult.pickedMesh == this.planet.sphere) {
			let region = this.planet.faces[pickResult.faceId].region;
			this.pickRegion(region);
		}
	}

	private assignRegions() {
		let players = this.players;
		let regionsBySize = this.regions.slice();

		// largest to smallest
		regionsBySize.sort((a: Region, b: Region): number => {
			return (b.faces.length - a.faces.length);
		});

		regionsBySize.forEach((r, idx) => {
			let gd: RegionGameData = { };

			gd.owner = players[idx % players.length];

			r.gameData = gd;
		});
	}

	private pickRegion(region: Region) {
		let pr = this.pickedRegion;
		if (pr && pr != region) {
			pr.setColor(pr.gameData.owner.color);
		}

		if (region) {
			region.setColor(region.gameData.owner.highlightColor);
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
}
