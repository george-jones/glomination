import * as BABYLON from 'babylonjs';
import * as rand from './rand';
import { Region, createRegions, claimIslands } from './countryMaker';

function getVertVector(positions: BABYLON.FloatArray, vertNum:number) : BABYLON.Vector3 {
	return new BABYLON.Vector3(positions[vertNum * 3 + 0],
		positions[vertNum * 3 + 1],
		positions[vertNum * 3 + 2]);
}

export class Face {
	index: number;
	vertices: number[];
	color: number[];
	connectedFaces: Face[];
	midPoint: BABYLON.Vector3;
	cellType: string;
	region: any;
	dripGroup: Face[];

	constructor(index: number, vertices: number[], color: number[], positions: BABYLON.FloatArray) {
		this.index = index;
		this.vertices = vertices;
		this.color = color.slice();
		this.connectedFaces = [ ];

		this.midPoint = new BABYLON.Vector3(0, 0, 0);
		this.vertices.forEach((v) => {
			this.midPoint.addInPlace(getVertVector(positions, v));
		});
		this.midPoint.normalize();
	}

	connectFace(face: Face) {
		this.connectedFaces.push(face);
	}
}

interface ColorChanger {
	(colorData : BABYLON.FloatArray) : void;
}

export interface TerraformSettings {
	complexity: number;
	numRivers: number;
	drizzleNum: number;
	safeSize: number;
	islandKillSize: number;
	islandSafeSize: number;
	islandNeighborhoodRadius: number;
	waterProportion: number;
	inlandSeaFillProporition: number;
	planetSize: number;
}

interface ColorDef {
	[index: string]: number[];
}

export class Planet {
	// The globe
	private sphere: BABYLON.Mesh;

	// Facet-vertex number list (every set of 3 vertices makes a facet)
	private indices: BABYLON.IndicesArray;

	// a map of vertex numbers that correspond to the same physical locations
	private colocatedVertMap: Array<Array<number>>;

	// a map of base vertex numbers to faces that contain them
	private vertFaceMap: Map<number, Face[]>;

	// A map of base vertex numbers to an array of neighboring base vertex numbers.
	// And what do I mean by "base" vertex numbers?  The are the ones that are first in their colocatedVertMap array.
	// So if vertices 0, 3, 6, 9, 12 are all actually the same point in space, vertex 0 is the base vertex number.
	//private vertNeighbors: Array<Array<number>>;
	private faces: Array<Face>;

	private tfSettings: TerraformSettings;

	// Countries, really
	private regions: Region[];

	private colors: ColorDef = {
		'water': [ 0.01, 0.05, 0.20 ], // water
		'unclaimed': [ 1.00, 1.00, 1.00 ], // unclaimed land
		'p0': [ 0.17, 0.22, 0.60 ], // blue
		'p1': [ 0.45, 0.45, 0.45 ], // grey
		'p2': [ 0.73, 0.13, 0.13 ], // red
		'p3': [ 0.83, 0.49, 0.11 ], // orange
		'p4': [ 0.50, 0.25, 0.57 ], // purple
		'p5': [ 0.80, 0.80, 0.08 ]  // yellow
	};

	constructor(sphere:BABYLON.Mesh, tfSettings: TerraformSettings) {
		this.sphere = sphere;
		this.indices = this.sphere.getIndices(); // hereby promising not to change the sphere so much that this becomes invalid
		this.faces = [];
		this.tfSettings = tfSettings;

		this.addColorVertexData();
		this.makeColocatedVertMap();
		this.fixCloseVertices();
		this.jumbleVertices();
		this.renormal();
		this.makeFaces();
	
		//const positions = sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);

		//moveVert(positions, this.colocatedVertMap, 0, new BABYLON.Vector3(-1, 1, 1));
		//this.sphere.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
		//this.sphere.updateFacetData();
	}

	public show() {
		this.sphere.isVisible = true;
	}

	public hide() {
		this.sphere.isVisible = false;
	}

	// The IcoSphere maker doesn't include color vertex data, so this adds that
	private addColorVertexData() {
		let colorArray = new Float32Array(this.sphere.getTotalVertices() * 4);
		this.sphere.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorArray);
		this.sphere.updateFacetData();
	}

	private makeColocatedVertMap() {
		const positions = this.sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);
		let posMap = new Map<string, Array<number>>();
		let colocatedVertMap;
		let maxVertNum = -1;
	
		this.indices.forEach((index:number) => {
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
	
		colocatedVertMap = new Array<Array<number>>(maxVertNum);
		posMap.forEach((v) => {
			v.forEach((index) => {
				colocatedVertMap[index] = v; // this is not a clone, but a pointer copy
			});
		});
	
		// icosphere vertices are already in a nice order, but if that changes this could help.
		/*
		colocatedVertMap.forEach((a) => {
			a.sort((a,b) => a-b); // numeric sort
		});
		*/
	
		this.colocatedVertMap = colocatedVertMap;
	}

	private fixCloseVertices() {
		let naughtyList = new Array<number>();
		const positions = this.sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);

		this.colocatedVertMap.forEach((a) => {
			if (a.length < 5) {
				if (naughtyList.indexOf(a[0]) < 0) {
					naughtyList.push(a[0]);
				}
			}
		});

		// although this is an n^2 operation, it is only looking at the
		// vertices that have problems so should be acceptably fast
		naughtyList.forEach(index1 => {
			let v1 = getVertVector(positions, index1)
			naughtyList.forEach(index2 => {
				if (index1 !== index2) {
					let v2 = getVertVector(positions, index2);
					let dist = v1.subtract(v2).length();
					let list1: number[];
					let list2: number[];
					
					// if they are close enough
					if (dist < 0.001) {
						// fix them to be in the same places
						this.colocatedVertMap[index2].forEach(vn => {
							this.moveVert(positions, vn, v1);
						});

						// combine their colocatedVertMap arrays
						if (index1 < index2) {
							list1 = this.colocatedVertMap[index1];
							list2 = this.colocatedVertMap[index2];
						} else {
							list1 = this.colocatedVertMap[index2];
							list2 = this.colocatedVertMap[index1];
						}

						if (list1.length < 5 && list2.length < 5) {
							list1.push(...list2);
							list2.forEach(vn => {
								this.colocatedVertMap[vn] = list1;
							});
						}
					}
				}
			});
		});
	}

	private getBaseVert(index: number): number {
		return this.colocatedVertMap[index][0];
	}

	// for every face, move one of its vertices randomly
	private jumbleVertices() {
		const positions = this.sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);
		const maxVeer = 0.3;

		for (let i=0; i < this.indices.length; i += 3) {
			let vn1 = this.getBaseVert(this.indices[i + 0]);
			let vn2 = this.getBaseVert(this.indices[i + 1]);
			let vn3 = this.getBaseVert(this.indices[i + 2]);

			let vertNums = rand.shuffle([ vn1, vn2, vn3 ]);

			let v1 = getVertVector(positions, vertNums[0]);
			let v2 = getVertVector(positions, vertNums[1]);
			let v3 = getVertVector(positions, vertNums[2]);

			v2.scaleInPlace(Math.random() * maxVeer);
			v3.scaleInPlace(Math.random() * maxVeer);
			
			v1.addInPlace(v2);
			v1.addInPlace(v3);
			v1.normalize();
			
			this.moveVert(positions, vertNums[0], v1);
		}

		this.sphere.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
		this.sphere.updateFacetData();
	}

	private renormal() {
		const positions = this.sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);
		this.sphere.setVerticesData(BABYLON.VertexBuffer.NormalKind, positions);
	}

	// This function moves all the vertices that occupy the same position as the identified one.
	// The move is only done in the positions array - the geometry still needs to be updated.
	private moveVert(positions: BABYLON.FloatArray, vertNum:number, newPosition: BABYLON.Vector3) {
		this.colocatedVertMap[vertNum].forEach((index) => {
			positions[index * 3 + 0] = newPosition.x;
			positions[index * 3 + 1] = newPosition.y;
			positions[index * 3 + 2] = newPosition.z;
		});
	}

	private makeFaces() {
		const positions = this.sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);

		for (let i=0; i < this.indices.length; i += 3) {
			let verts = [
				this.indices[i + 0],
				this.indices[i + 1],
				this.indices[i + 2]
			];
			
			let f = new Face(i / 3, verts, this.colors.unclaimed, positions);
			this.faces.push(f);
		}

		this.vertFaceMap = new Map<number, Face[]>();

		this.faces.forEach((f) => {
			f.vertices.forEach((vn) => {
				let bv = this.getBaseVert(vn);
				let faces = this.vertFaceMap.get(bv);

				if (!faces) {
					faces = [ ];
					this.vertFaceMap.set(bv, faces);
				}

				faces.push(f);
			});
		});

		// for each face, find its neighbors - those that share 2 vertices
		let minCon = -1;
		let maxCon = -1;
		this.faces.forEach((f) => {
			let foundOnce = <Face[]> [ ];
			let foundTwice = <Face[]> [ ];

			f.vertices.forEach((v, idx) => {
				let bn = this.getBaseVert(v);
				let otherFaces = this.vertFaceMap.get(bn);
				otherFaces.forEach((otherFace) => {
					if (otherFace != f) {
						if (foundOnce.indexOf(otherFace) < 0) {
							foundOnce.push(otherFace);
						} else {
							foundTwice.push(otherFace);
						}
					}
				});
			});

			if (minCon == -1 || foundTwice.length < minCon) {
				minCon = foundTwice.length;
			}

			if (foundTwice.length > maxCon) {
				maxCon = foundTwice.length;
			}

			foundTwice.forEach((otherFace) => {
				f.connectFace(otherFace);
			});
		});
	}

	public reColorAll() {
		this.reColor((colorData : BABYLON.FloatArray) => {
			this.faces.forEach((f) => {
				f.vertices.forEach((vertNum) => {
					colorData[vertNum * 4 + 0] = f.color[0];
					colorData[vertNum * 4 + 1] = f.color[1];
					colorData[vertNum * 4 + 2] = f.color[2];
					colorData[vertNum * 4 + 3] = 1.0;
				});
			});
		});
	}

	// Call this to make changes to face colors.  This makes it so we don't
	// keep around a big list of color data for any longer than needed, and also
	// that we don't retrieve it on every single face change.
	private reColor(changeFunc : ColorChanger) {
		let colorData = this.sphere.getVerticesData(BABYLON.VertexBuffer.ColorKind);
		changeFunc(colorData);
		this.sphere.setVerticesData(BABYLON.VertexBuffer.ColorKind, colorData);
	}

	public makeRivers() {
		for (let i=0; i < this.tfSettings.numRivers; i++) {
			this.makeRiver();
		}
	}

	public faceWaterify(face: Face, dripGroup?: Face[]) {
		face.color = this.colors.water;
		face.cellType = 'water';
		face.region = null;

		if (dripGroup) {
			face.dripGroup = dripGroup;
			dripGroup.push(face);
		}
	}

	private faceLandify(face:Face) {
		face.color = this.colors.unclaimed;
		face.cellType = undefined;
	};

	private makeRiver() {
		// pick a random point (two angles)
		let phi = Math.PI * Math.random();
		let theta = 2 * Math.PI * Math.random();
		let v1 = new  BABYLON.Vector3(Math.sin(phi) * Math.cos(theta),
			Math.sin(phi) * Math.sin(theta),
			Math.cos(phi));

		// pick a 2nd random point very nearby, but not identical
		let phi_a = phi + ((Math.random() >= 0.5)? -1 : 1) * (0.01 + 0.01 * Math.random());
		let theta_a = theta + ((Math.random() >= 0.5)? -1 : 1) * (0.01 + 0.01 * Math.random());
		let va = new BABYLON.Vector3(Math.sin(phi_a) * Math.cos(theta_a),
			Math.sin(phi_a) * Math.sin(theta_a),
			Math.cos(phi_a));

		// find normal vector
		let n = v1.cross(va).normalize();
		let v2 = n.cross(v1).normalize();
		let v3 = n.cross(v2).normalize();
		let v4 = n.cross(v3).normalize();

		// These 4 points are 90 degrees apart and make a circle around the globe
		let pts = [ v2, v3, v4, v1 ];

		// find the face that is closest to the starting point
		let startingFace: Face = ((): Face => {
			let sf: Face;
			let dist = -1;

			this.faces.forEach(function (f) {
				let d = f.midPoint.subtract(v1).lengthSquared();
				if (!sf || d < dist) {
					dist = d;
					sf = f;
				}
			});

			return sf;
		})();

		let path = [ ];
		let face = startingFace;
		let prevTarget = startingFace.midPoint;
		let currentPoint = 0;

		while (true) {
			let neighbors = face.connectedFaces;
			let n:Face[] = [ ];
			let target = pts[currentPoint];

			path.push(face);
			this.faceWaterify(face);

			let minDist = -1;
			let faceInDirection: Face;

			neighbors.forEach(function (f) {
				if (f.cellType != 'water') {
					let d = f.midPoint.subtract(target).lengthSquared();

					if (faceInDirection === undefined || d < minDist) {
						minDist = d;
						faceInDirection = f;
					}

					n.push(f);
				}
			});

			if (n.length == 0) {
				break;
			}

			if (Math.random() < 0.3) {
				face = n[Math.floor(n.length * Math.random())];
			} else {
				face = faceInDirection;
			}

			if (currentPoint + 1 < pts.length && face.midPoint.subtract(prevTarget).lengthSquared() > face.midPoint.subtract(target).lengthSquared()) {
				currentPoint++;
				if (currentPoint >= pts.length) {
					break;
				}
				prevTarget = target;
			}
		}
	}

	public drizzle() {
		let i = 0;
		let t = 0;
		let f: Face;
		let dripGroup: Face[];
		let num: number = this.tfSettings.drizzleNum;

		for (i=0; i < num * 5 && t < num; i++) {
			f = rand.pick(this.faces)[0];
			if (!f.connectedFaces.some(function (cf) {
				if (cf.cellType == 'water') {
					return true;
				}
			})) {
				dripGroup = [ ];
				this.faceWaterify(f, dripGroup);
				t++;
			}
		}
	};

	 // Expands watery areas until the desired proportion of the globe is liquid
	public expandWaters() {
		let planet = this;
		let faces = this.faces;
		let waterProportion:number = this.tfSettings.waterProportion;
		let inlandSeaFillProporition: number = this.tfSettings.inlandSeaFillProporition;
		let currentWatery = 0;
		let wateryWanted = Math.floor(waterProportion * faces.length);
		let waterFaces = [ ];
		let dripGroups = [ ];

		faces.forEach(function (f) {
			if (f.cellType == 'water') {
				currentWatery++;
				waterFaces.push(f);
			}
		});

		while (true) {
			let fpick = rand.pick(waterFaces);
			let landNeighbors: Face[] = [ ];
			let pickedNeighbor;
			let f;
			let face;

			if (!fpick[0]) {
				break;
			}

			face = fpick[0];
			face.connectedFaces.forEach((nface: Face) => {
				if (nface.cellType != 'water') {
					landNeighbors.push(nface);
				}
			});

			if (landNeighbors.length == 0) {
				waterFaces.splice(fpick[1], 1);
			} else {
				pickedNeighbor = rand.pick(landNeighbors);
				f = pickedNeighbor[0];
				waterFaces.push(f);
				this.faceWaterify(f, face.dripGroup);
				if (face.dripGroup && dripGroups.indexOf(face.dripGroup) == -1) {
					dripGroups.push(face.dripGroup);
				}
				currentWatery++;
			}

			if (currentWatery >= wateryWanted) {
				break;
			}
		}

		// consolidate drip groups
		dripGroups.forEach((dg: Face[]) => {
			let connected: Face[];
			if (dg.some(function (face: Face) {
				if (face.connectedFaces.some(function (cf) {
					if (cf.dripGroup && cf.dripGroup != face.dripGroup) {
						connected = cf.dripGroup;
						return true;
					}
				})) {
					return true;
				}
			})) {
				if (connected) {
					dg.forEach(function (face) {
						face.dripGroup = connected;
						connected.push(face);
					});
					dg.splice(0, dg.length);
				}
			}
		});
		
		// fill in most drip groups that have no contact with seawater
		dripGroups.forEach((dg: Face[]) => {
			if (dg.length > 0) {
				if (!dg.some((face: Face) => {
					/// check face for contact with seawater
					if (face.connectedFaces.some((cf) => {
						if (cf.cellType == 'water' && !cf.dripGroup) {
							return true;
						}
					})) {
						return true;
					}
				})) {
					// fill in, probably
					if (Math.random() <= inlandSeaFillProporition) {
						dg.forEach(function (face) {
							planet.faceLandify(face);
						});
					}
				}
			}
		});
	};

	public despeckle() {
		let faces = this.faces;
		let planet = this;

		faces.forEach(function (face) {
			// find land that is not touching other land
			if (face.cellType != 'water') {
				if (!face.connectedFaces.some(function (nf) {
					if (nf.cellType != 'water') {
						return true;
					}
				})) {
					// see if there is a connected face that could make a land bridge
					if (!face.connectedFaces.some(function (nf) {
						// see if any of the faces linked to that connected face are land.
						if (nf.connectedFaces.some(function (lf) {
							if (lf != face && lf.cellType != 'water') {
								planet.faceLandify(nf);
								return true;
							}
						})) {
							return true;
						}
					})) {
						// if not, cover the face with water
						planet.faceWaterify(face);
					}
				}
			}
		});
	}

	private faceMoveRegion (f: Face, oldRegion: Region, newRegion: Region) {
		newRegion.faces.push(f);
		oldRegion.faces.splice(oldRegion.faces.indexOf(f), 1);
		if (newRegion.color) {
			f.color = newRegion.color;
		}
		f.region = newRegion;
	}

	// Move single pointy faces to surrounding region
	public deSpindlify () {
		let planet = this;
		let i = 0;
		let num = 1;

		for (i=0; i < num; i++) {
			this.regions.forEach(function (r) {
				r.faces.forEach(function (f) {
					let otherRegion: Region;
					let connectedToSelf = 0;
					if (!f.connectedFaces.some(function (cf) {
						if (cf.region == r) {
							connectedToSelf++;
							if (connectedToSelf > 1) {
								// more than 1 neighboring face in same region, stop.
								return true;
							}
						} else if (cf.region != otherRegion) {
							if (otherRegion != null) {
								// more than 1 neighboring region, stop.
								return true;
							}
							otherRegion = cf.region;
						}
					})) {
						if (otherRegion) {
							planet.faceMoveRegion(f, f.region, otherRegion);
						}
					}
				});
			});
		}
	}

	public createRegions() {
		let planet = this;
		let regions = createRegions(this.faces, this.tfSettings);
		this.regions = claimIslands(this, regions, this.tfSettings);

		// temporary
		let colorNames = Object.keys(planet.colors).filter((k) => k.startsWith('p'));

		this.regions.forEach((r) => {
			let colorName: string = rand.pick(colorNames)[0];
			r.setColor(<number[]> planet.colors[colorName]);
		});
	}

	public unJaggyBorders() {
		let planet = this;
		let faces = this.faces;
		let positions = this.sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);

		faces.forEach((f) => {
			var hasBorder = false;
			var similarNeighbor: Face;
			var similarNeighbors: Face[] = [ ];
			if (f.cellType != 'water') {
				f.connectedFaces.forEach(function (cf) {
					if (cf.cellType == 'water' || cf.region != f.region) {
						hasBorder = true;
					} else {
						similarNeighbors.push(cf);
					}
				});
				if (similarNeighbors.length > 0) {
					similarNeighbor = rand.pick(similarNeighbors)[0];
				}
				if (hasBorder && similarNeighbor) {
					// find the vert that can be adjusted - the one that isn't in common between
					// the 2 faces
					f.vertices.forEach(function (vertNum) {
						if (! similarNeighbor.vertices.some(function (nwv) {
							return planet.getBaseVert(nwv) == planet.getBaseVert(vertNum);
						})) {
							let points: BABYLON.Vector3[];
							let weights: number[];
							let newVert = new BABYLON.Vector3(0, 0, 0);
							let minWeight = 9;

							points = f.vertices.map((vnum) => getVertVector(positions, vnum));
							weights = [ minWeight + Math.random(), minWeight + Math.random(), minWeight + Math.random() ];
							points.forEach((v, i) => {
								v.scaleInPlace(weights[i]);
								newVert.addInPlace(v);
							});

							newVert.normalize();
							planet.moveVert(positions, vertNum, newVert);
						}
					});
				}
			}
		});

		this.sphere.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
		this.sphere.updateFacetData();
	}
}