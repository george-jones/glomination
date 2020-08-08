import * as BABYLON from 'babylonjs';


const getFacetVerts =
(
	faceNum: number,
	indices: BABYLON.IndicesArray,
	positions: BABYLON.FloatArray
) : Array<BABYLON.Vector3> =>
{
	let v1Start = indices[3*faceNum];
	let v2Start = indices[3*faceNum + 1];
	let v3Start = indices[3*faceNum + 2];
	return [
		new BABYLON.Vector3(positions[3*v1Start], positions[3*v1Start + 1], positions[3*v1Start + 2]),
		new BABYLON.Vector3(positions[3*v2Start], positions[3*v2Start + 1], positions[3*v2Start + 2]),
		new BABYLON.Vector3(positions[3*v3Start], positions[3*v3Start + 1], positions[3*v3Start + 2])
	];
}

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

		// This creates and positions a free camera (non-mesh)
		//const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 0, -2.65), scene);
		const camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI/2, Math.PI/2, 2.65, BABYLON.Vector3.Zero(), scene);
		camera.lowerRadiusLimit = 2.0;
		camera.upperRadiusLimit = 50;
		camera.wheelPrecision = 250;
		camera.angularSensibilityX = 2000;
		camera.angularSensibilityY = 2000;
		camera.attachControl(canvas, false)

		// This attaches the camera to the canvas
		//camera.attachControl(canvas, true);

		// This creates a light, aiming 0,1,0 - to the sky (non-mesh)
		//const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0.5, 0.5, -1), scene);
		//const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 0, -1), scene);
		const light = new BABYLON.PointLight("sun", new BABYLON.Vector3(0, 0, -1 * lightDistance), scene);

		// Default intensity is 1. Let's dim the light a small amount
		light.intensity = 0.75;
		
		const colors = [
			[ 0.01, 0.07, 0.27 ],
			[ 0.17, 0.42, 0.50 ],
			[ 0.4, 0.4, 0.4 ],
			[ 0.73, 0.13, 0.13 ],
			[ 0.83, 0.49, 0.11 ],
			[ 0.67, 0.27, 0.67 ],
			[ 1.0, 1.0, 0 ]
		];

		let mat = new BABYLON.StandardMaterial('worldMaterial', scene);
		mat.specularColor = new BABYLON.Color3(0, 0, 0); // no shininess
		mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
		
		//const materialForBall = new BABYLON.StandardMaterial("texture1", scene);
		

		//materialForBall.specularColor = new BABYLON.Color3(0, 0, 0); // no shininess
		

/*
	 * 'Very low' -> 1280 faces --> 8 subdiv
	 * 'Low' -> 5120 faces --> 16 subdiv
	 * 'Medium' -> 20480 faces --> 32 subdiv
	 * 'High' -> 81920 faces --> 64 subdiv
*/

		const sphere = BABYLON.MeshBuilder.CreateIcoSphere("globe",
			{radius: 1, subdivisions: 1, updatable: true }, scene);
		sphere.material = mat;

		let colorArray = new Float32Array(sphere.getTotalVertices() * 4);

		// make it all water
		for (let i=0; i < sphere.getTotalVertices(); i++) {
			//let cnum = Math.floor(Math.random() * colors.length);
			let cnum = 0;
			colorArray[i*4] = colors[cnum][0];
			colorArray[i*4 + 1] = colors[cnum][1];
			colorArray[i*4 + 2] = colors[cnum][2];
			colorArray[i*4 + 3] = 1;
		}

		//BABYLON.VertexBuffer.
		sphere.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorArray);
		sphere.updateFacetData();

		console.log('Number of facets', sphere.facetNb);
		console.log('Number of vertices', sphere.getTotalVertices());

		//console.log(sphere.getIndices());
		//console.log(sphere.getVertexBuffer(BABYLON.VertexBuffer.PositionKind).getData());
		//console.log(sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind));
		//sphere.getIndices()

		// Theory: facet number * 3 = 1st vertex in indices
		// Is it true?
		let ind = sphere.getIndices();
		let vertPos = sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);
		let facetNum = 2;
		let facetPositions = sphere.getFacetLocalPositions();

		let facetMidX = facetPositions[facetNum].x;
		let facetMidY = facetPositions[facetNum].y;
		let facetMidZ = facetPositions[facetNum].z;
		console.log(facetMidX, facetMidY, facetMidZ);

		let verts = getFacetVerts(facetNum, ind, vertPos);
		let mx = 0;
		let my = 0;
		let mz = 0;
		verts.forEach(v => {
			mx += v.x;
			my += v.y;
			mz += v.z;
		});
		mx /= 3;
		my /= 3;
		mz /= 3;
		console.log(mx, my, mz);

		/*

		let vmX = (vertPos[0] + vertPos[3] + vertPos[6]) / 3;
		let vmY = (vertPos[1] + vertPos[4] + vertPos[7]) / 3;
		let vmZ = (vertPos[2] + vertPos[5] + vertPos[8]) / 3;
		console.log(vmX, vmY, vmZ);
		*/

		//console.log(vertPos);
		//console.log(facetPositions);


		
		//console.log(sphere.getVertexBuffer(BABYLON.VertexBuffer.ColorKind).getData());
		//console.log(sphere.getIn
			//(BABYLON.VertexBuffer.PositionKind).getData());

		//for (let i=0; i < sphere.facetNb; i++) {
			//sphere.getfacet
		//}
		//console.log('Number of facets', sphere.facetNb);

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

		//scene.onBeforeRenderObservable.add(function () {

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
