import * as BABYLON from 'babylonjs';

import * as rand from './rand';
import { Planet, Face } from './planet';
import { Region } from './countryMaker';

export class Game {
	private planet: Planet;
	private scene: BABYLON.Scene;
	private regions: Region[];
	private pickedRegion: Region;
	private mouseDownFaceId: number;

	private colors: number[][] = [
		[ 0.17, 0.22, 0.60 ], // blue
		[ 0.45, 0.45, 0.45 ], // grey
		[ 0.73, 0.13, 0.13 ], // red
		[ 0.20, 0.60, 0.10 ], // green
		[ 0.50, 0.25, 0.57 ], // purple
		[ 0.95, 0.95, 0.10 ]  // yellow
	];

	private pickedColors: number[][] = [
		[ 0.48, 0.47, 0.90 ], // blue
		[ 0.85, 0.85, 0.85 ], // grey
		[ 1.00, 0.43, 0.43 ], // red
		[ 0.40, 0.95, 0.35 ], // green
		[ 0.91, 0.40, 0.98 ], // purple
		[ 1.00, 1.00, 0.60 ]  // yellow
	];

	constructor (planet: Planet, scene: BABYLON.Scene) {
		this.planet = planet;
		this.scene = scene;
		this.regions = this.planet.regions;

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

	private highlightRegion() {
		let pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
		if (pickResult.pickedMesh == this.planet.sphere) {
			let region = this.planet.faces[pickResult.faceId].region;
			this.pickRegion(region);
		}
	}

	private pickRegion(region: Region) {
		if (this.pickedRegion && this.pickedRegion != region) {
			this.pickedRegion.setColor(this.colors[5]);
		}

		if (region) {
			region.setColor(this.pickedColors[5]);
		}
		this.pickedRegion = region;
		
		this.planet.reColorAll();
	}

	private colorRegions() {
		this.regions.forEach((r, idx) => {
			//let num = rand.rangeInt(0, this.colors.length - 1);
			let num = 5;

			r.setColor(this.colors[num]);
		});

		this.planet.reColorAll();
	}
}
