import * as BABYLON from 'babylonjs';

import { Planet } from './planet';

export default class Renderer {
	private _canvas: HTMLCanvasElement;
	private _engine: BABYLON.Engine;
	private _scene: BABYLON.Scene;
	private planet: Planet;

	createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
		const lightDistance = 10;
		const minWheelPrecision = 5;
		const maxWheelPrecision = 250;
		this._canvas = canvas;

		this._engine = engine;

		// This creates a basic Babylon Scene object (non-mesh)
		const scene = new BABYLON.Scene(engine);
		this._scene = scene;

		scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);

		const camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI/2, Math.PI/2, 2.65, BABYLON.Vector3.Zero(), scene);
		camera.lowerRadiusLimit = 2.0;
		camera.upperRadiusLimit = 50;
		camera.wheelPrecision = 250;
		camera.angularSensibilityX = 2000;
		camera.angularSensibilityY = 2000;
		camera.attachControl(canvas, false)

		const light = new BABYLON.PointLight("sun", new BABYLON.Vector3(0, 0, -1 * lightDistance), scene);
		light.intensity = 0.75;
		
		let mat = new BABYLON.StandardMaterial('worldMaterial', scene);
		mat.specularColor = new BABYLON.Color3(0, 0, 0); // no shininess
		mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
		//mat.wireframe = true;
/*
	 * 'Very low' -> 1280 faces  ->  8 subdiv
	 * 'Low'      -> 5120 faces  -> 16 subdiv
	 * 'Medium'   -> 20480 faces -> 32 subdiv
	 * 'High'     -> 81920 faces -> 64 subdiv
*/

		const sphere = BABYLON.MeshBuilder.CreateIcoSphere("globe",
			{radius: 1, subdivisions: 32, updatable: true }, scene);
		sphere.material = mat;
		//sphere.convertToFlatShadedMesh();

		this.planet = new Planet(sphere, {
			"complexity": 5,
			"numRivers": 10,
			"drizzleNum": 100,
			"safeSize": 80,
			"islandKillSize": 5,
			"islandSafeSize": 20,
			"islandNeighborhoodRadius": 13,
			"planetSize": 5.1e8,
			"waterProportion": 0.67,
			"inlandSeaFillProporition": 0.8
		});
		this.planet.hide();

		// This targets the camera to scene origin
		camera.setTarget(sphere);

		/// getClosestFacetAtCoordinates

		let lastCameraPos = camera.position.clone();

		scene.registerBeforeRender(function () {
			if (lastCameraPos.x != camera.position.x ||
				lastCameraPos.y != camera.position.y ||
				lastCameraPos.z != camera.position.z)
			{
				let lightPos = camera.position.clone();
				lightPos.scaleInPlace(lightDistance / lightPos.length());
				light.position = lightPos;

				lastCameraPos = camera.position.clone();

				camera.wheelPrecision = Math.max(minWheelPrecision, maxWheelPrecision - 100 * (lastCameraPos.length() - camera.lowerRadiusLimit));
			}
		});

		this.doTerraform(-1);
	}

	initialize(canvas: HTMLCanvasElement) {
		const engine = new BABYLON.Engine(canvas, true);
		this.createScene(canvas, engine);

		engine.runRenderLoop(() => {
			this._scene.render();
		});

		window.addEventListener('resize', function () {
			engine.resize();
		});
	}

	private doTerraform(stepNum: number) {
		window.requestAnimationFrame(() => {
			let quit = false;

			stepNum++;
			if (stepNum == 0) {
				this.planet.makeRivers();
			} else if (stepNum == 1) {
				this.planet.drizzle();
			} else if (stepNum == 2) {
				this.planet.expandWaters();
			} else if (stepNum == 3) {
				this.planet.despeckle();
			} else if (stepNum == 4) {
				this.planet.createRegions();
			} else if (stepNum == 5) {
				this.planet.deSpindlify();
			} else if (stepNum == 6) {
				this.planet.unJaggyBorders();
			} else {
				this.planet.reColorAll();
				this.planet.show();
				quit = true;
			}

			if (!quit) {
				this.doTerraform(stepNum);
			}
		});
	}
}

const renderer = new Renderer();
renderer.initialize(document.getElementById('render-canvas') as HTMLCanvasElement);
