import * as BABYLON from 'babylonjs';

import { Planet } from './planet';

export default class Renderer {
	private canvas: HTMLCanvasElement;
	private engine: BABYLON.Engine;
	private scene: BABYLON.Scene;
	private planet: Planet;
	private sphere: BABYLON.Mesh;

	createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
		//const lightDistance = 10;
		const lightDistance = 1.4; //1.5;
		const minWheelPrecision = 5;
		const maxWheelPrecision = 250;
		this.canvas = canvas;
		this.engine = engine;

		// This creates a basic Babylon Scene object (non-mesh)
		const scene = new BABYLON.Scene(engine);
		this.scene = scene;

		scene.clearColor = new BABYLON.Color4(0.07, 0.07, 0.07, 1.0);

		const camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI/2, Math.PI/2, 2.65, BABYLON.Vector3.Zero(), scene);
		camera.lowerRadiusLimit = 2.01;
		camera.upperRadiusLimit = 10;
		camera.wheelPrecision = 250;
		camera.angularSensibilityX = 2000;
		camera.angularSensibilityY = 2000;
		camera.attachControl(canvas, false)

		const light = new BABYLON.PointLight("sun", new BABYLON.Vector3(0, 0, -1 * lightDistance), scene);
		light.intensity = 0.75;
		
		let mat = new BABYLON.StandardMaterial('worldMaterial', scene);
		mat.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
		mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02); // shininess
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
		this.sphere = sphere;
		sphere.material = mat;
		let actions = new BABYLON.ActionManager(scene);
		sphere.actionManager = actions;

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

		window.addEventListener('click', () => {
			//console.log(scene.pointerX, scene.pointerY);
			let pickResult = scene.pick(scene.pointerX, scene.pointerY);
			if (pickResult.pickedMesh == sphere) {
				let region = this.planet.faces[pickResult.faceId].region;
				if (region) {
					// do something
				}
			}
		});

		// This targets the camera to scene origin
		camera.setTarget(sphere);

		light.parent = camera;

		let bgPlane = BABYLON.MeshBuilder.CreatePlane("bgPlane", {width: 500, height: 500}, scene);
		bgPlane.parent = camera;
		bgPlane.isPickable = false;

		let bgMat = new BABYLON.StandardMaterial('backgroundMaterial', scene);
		bgMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
		bgMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
		bgPlane.material = bgMat;
		bgPlane.position.set(0, 0, 50);

		this.doTerraform(-1);
	}

	initialize(canvas: HTMLCanvasElement) {
		const engine = new BABYLON.Engine(canvas, true);
		this.createScene(canvas, engine);

		engine.runRenderLoop(() => {
			this.scene.render();
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
				this.planet.smoothPerimeters();
			} else if (stepNum == 7) {
				this.planet.createBorders();
			} else {
				this.planet.reColorAll();
				// We're supposed to do this after modifying the geometry, which the above
				// steps certainly have.  But doing that make the mesh unpickable for some
				// reason.  Weird!
				// this.sphere.updateFacetData();
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
