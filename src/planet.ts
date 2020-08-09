import * as BABYLON from 'babylonjs';

export default class Planet {
	// The ball
	sphere: BABYLON.Mesh;

	// a map of vertex numbers that correspond to the same physical locations
	vertMap: Array<Array<number>>;

	// A map of base vertex numbers to an array of neighboring base vertex numbers.
	// And what do I mean by "base" vertex numbers?  The are the ones that are first in their vertMap array.
	// So if vertices 0, 3, 6, 9, 12 are all actually the same point in space, vertex 0 is the base vertex number.
	vertNeighbors: Array<Array<number>>;

	constructor(sphere:BABYLON.Mesh) {
		this.sphere = sphere;

		this.addColorVertexData();
		this.makeVertMap();
		this.fixCloseVertices();

		//youbad.forEach((val) => {
		//	console.log(val + ': ' + this.getVertVector(positions, val))
		//});

		this.jumbleVertices();

		//const positions = sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);

		//moveVert(positions, this.vertMap, 0, new BABYLON.Vector3(-1, 1, 1));
		//this.sphere.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
		//this.sphere.updateFacetData();
	}

	// The IcoSphere maker doesn't include color vertex data, so this adds that
	private addColorVertexData() {
		let colorArray = new Float32Array(this.sphere.getTotalVertices() * 4);

		// for now, make it all blue.  If we don't do this, it will be zeros by default (black)
		for (let i=0; i < this.sphere.getTotalVertices(); i++) {
			colorArray[i*4 + 0] = 0.01;
			colorArray[i*4 + 1] = 0.07;
			colorArray[i*4 + 2] = 0.27;
			colorArray[i*4 + 3] = 1;
		}

		this.sphere.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorArray);
		this.sphere.updateFacetData();
	}

	private makeVertMap() {
		const indices = this.sphere.getIndices();
		const positions = this.sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);
		let posMap = new Map<string, Array<number>>();
		let vertMap;
		let maxVertNum = -1;
	
		indices.forEach((index:number) => {
			let k = positions[3 * index] + ',' + positions[3 * index + 1]  + ',' + positions[3 * index + 2];
			let vertList = posMap.get(k);
	
			if (!vertList) {
				vertList = new Array<number>();
				posMap.set(k, vertList);
			}
	
			if (!(index in vertList)) {
				vertList.push(index);
			}
	
			if (index > maxVertNum) {
				maxVertNum = index;
			}
		});
	
		vertMap = new Array<Array<number>>(maxVertNum);
		posMap.forEach((v) => {
			v.forEach((index) => {
				vertMap[index] = v; // this is not a clone, but a pointer copy
			});
		});
	
		// icosphere vertices are already in a nice order, but if that changes this could help.
		/*
		vertMap.forEach((a) => {
			a.sort((a,b) => a-b); // numeric sort
		});
		*/
	
		this.vertMap = vertMap;
	}

	private fixCloseVertices() {
		let naughtyList = new Array<number>();
		const positions = this.sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);

		this.vertMap.forEach((a) => {
			if (a.length < 5) {
				if (naughtyList.indexOf(a[0]) < 0) {
					naughtyList.push(a[0]);
				}
			}
		});

		console.log('Vertices to combine', naughtyList.length);

		// although this is an n^2 operation, it is only looking at the
		// vertices that have problems so should be acceptably fast
		naughtyList.forEach(index1 => {
			let v1 = this.getVertVector(positions, index1)
			naughtyList.forEach(index2 => {
				if (index1 !== index2) {
					let v2 = this.getVertVector(positions, index2);
					let dist = v1.subtract(v2).length();
					let list1: number[];
					let list2: number[];
					
					// if they are close enough
					if (dist < 0.001) {
						// fix them to be in the same places
						this.vertMap[index2].forEach(vn => {
							this.moveVert(positions, vn, v1);
						});

						// combine their vertMap arrays
						if (index1 < index2) {
							list1 = this.vertMap[index1];
							list2 = this.vertMap[index2];
						} else {
							list1 = this.vertMap[index2];
							list2 = this.vertMap[index1];
						}

						if (list1.length < 5 && list2.length < 5) {
							list1.push(...list2);
							list2.forEach(vn => {
								this.vertMap[vn] = list1;
							});
						}
					}
				}
			});
		});
	}


	// for every face, move one of its vertices randomly
	private jumbleVertices() {
		const indices = this.sphere.getIndices();
		const positions = this.sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);
		const maxVeer = 0.5;

		for (let i=0; i < indices.length; i += 3) {
			let vn1 = this.vertMap[indices[i + 0]][0];
			let vn2 = this.vertMap[indices[i + 1]][0];
			let vn3 = this.vertMap[indices[i + 2]][0];
			let v1 = this.getVertVector(positions, vn1);
			let v2 = this.getVertVector(positions, vn2);
			let v3 = this.getVertVector(positions, vn3);

			v2.scaleInPlace(Math.random() * maxVeer);
			v3.scaleInPlace(Math.random() * maxVeer);
			
			v1.addInPlace(v2);
			v1.addInPlace(v3);
			v1.normalize();
			
			this.moveVert(positions, vn1, v1);
		}

		this.sphere.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
		this.sphere.updateFacetData();
	}

	// This function moves all the vertices that occupy the same position as the identified one.
	// The move is only done in the positions array - the geometry still needs to be updated.
	private moveVert(positions: BABYLON.FloatArray, vertNum:number, newPosition: BABYLON.Vector3) {
		this.vertMap[vertNum].forEach((index) => {
			positions[index * 3 + 0] = newPosition.x;
			positions[index * 3 + 1] = newPosition.y;
			positions[index * 3 + 2] = newPosition.z;
		});
	}

	private getVertVector(positions: BABYLON.FloatArray, vertNum:number) : BABYLON.Vector3 {
		return new BABYLON.Vector3(positions[vertNum * 3 + 0],
			positions[vertNum * 3 + 1],
			positions[vertNum * 3 + 2]);
	}
}



/*

const getFacetVerts = (faceNum: number, indices: BABYLON.IndicesArray, positions: BABYLON.FloatArray) : Array<BABYLON.Vector3> => {
	let v1Start = indices[3*faceNum];
	let v2Start = indices[3*faceNum + 1];
	let v3Start = indices[3*faceNum + 2];
	return [
		new BABYLON.Vector3(positions[3*v1Start], positions[3*v1Start + 1], positions[3*v1Start + 2]),
		new BABYLON.Vector3(positions[3*v2Start], positions[3*v2Start + 1], positions[3*v2Start + 2]),
		new BABYLON.Vector3(positions[3*v3Start], positions[3*v3Start + 1], positions[3*v3Start + 2])
	];
}


const colors = [
	[ 0.01, 0.07, 0.27 ],
	[ 0.17, 0.42, 0.50 ],
	[ 0.4, 0.4, 0.4 ],
	[ 0.73, 0.13, 0.13 ],
	[ 0.83, 0.49, 0.11 ],
	[ 0.67, 0.27, 0.67 ],
	[ 1.0, 1.0, 0 ]
];


*/