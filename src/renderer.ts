import * as BABYLON from 'babylonjs';

export default class Renderer {
	private _canvas: HTMLCanvasElement;
	private _engine: BABYLON.Engine;
	private _scene: BABYLON.Scene;

	createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
		this._canvas = canvas;

		this._engine = engine;

		// This creates a basic Babylon Scene object (non-mesh)
		const scene = new BABYLON.Scene(engine);
		this._scene = scene;

		// This creates and positions a free camera (non-mesh)
		const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 0, -2.65), scene);

		// This targets the camera to scene origin
		camera.setTarget(BABYLON.Vector3.Zero());

		// This attaches the camera to the canvas
		camera.attachControl(canvas, true);

		// This creates a light, aiming 0,1,0 - to the sky (non-mesh)
		const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 0, -10), scene);

		// Default intensity is 1. Let's dim the light a small amount
		light.intensity = 0.7;

		const materialForBall = new BABYLON.StandardMaterial("texture1", scene);
		materialForBall.wireframe = true;

		// Our built-in 'sphere' shape. Params: name, subdivs, size, scene
		//const sphere = BABYLON.Mesh.CreateSphere("sphere1", 32, 1, scene);
		const sphere = BABYLON.MeshBuilder.CreateIcoSphere("globe", {radius: 1, radiusY: 1, subdivisions: 20}, scene);
		sphere.material = materialForBall;

		// Move the sphere upward 1/2 its height
		//sphere.position.y = 1;

		/*
		let axis = new BABYLON.Vector3(1, 0, 0);
		let angle = Math.PI / 2;
		let quaternion = new BABYLON.Quaternion.RotationAxis(axis, angle);
		sphere.rotationQuaternion = quaternion;
		*/
		//sphere.rotate(BABYLON.Axis.X, -Math.PI/2, BABYLON.Space.WORLD);

		// Our built-in 'ground' shape. Params: name, width, depth, subdivs, scene
		//const ground = BABYLON.Mesh.CreateGround("ground1", 6, 6, 2, scene);
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
