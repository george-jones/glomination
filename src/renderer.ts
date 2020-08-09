import * as BABYLON from 'babylonjs';

import Planet from './planet';

export default class Renderer {
	private _canvas: HTMLCanvasElement;
	private _engine: BABYLON.Engine;
	private _scene: BABYLON.Scene;

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

		let p = new Planet(sphere);

		console.log('Number of facets', sphere.facetNb);
		console.log('Number of vertices', sphere.getTotalVertices());

		// This targets the camera to scene origin
		camera.setTarget(sphere);

		/// getClosestFacetAtCoordinates

		/*
		let axis = new BABYLON.Vector3(1, 0, 0);
		let angle = Math.PI / 2;
		let quaternion = new BABYLON.Quaternion.RotationAxis(axis, angle);
		sphere.rotationQuaternion = quaternion;
		*/
		//sphere.rotate(BABYLON.Axis.X, -Math.PI/2, BABYLON.Space.WORLD);

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
}

const renderer = new Renderer();
renderer.initialize(document.getElementById('render-canvas') as HTMLCanvasElement);
