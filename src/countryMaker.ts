import * as BABYLON from 'babylonjs';
import * as rand from './rand';
import { Planet, Face, TerraformSettings } from './planet';

export class Region {
	public faces: Face[];
	neighbors: Region[];
	eaten: boolean;
	coastal: boolean;
	midPoint: BABYLON.Vector3;
	startingPoint: BABYLON.Vector3;
	borderFaces: Face[];
	color: number[];
	gameData = { }; // a place for higher layer code to store game-specific data for this region
	borderMesh: BABYLON.Mesh;

	constructor () {
		this.faces = [ ];
		this.neighbors = [ ];
		this.eaten = false;
		this.coastal = false;
		this.midPoint = new BABYLON.Vector3(0, 0, 0);
		this.startingPoint = null;
		this.borderFaces = [ ];
		this.color = null;
		this.gameData = { };
	}

	private setMidPoint () {
		this.midPoint.set(0, 0, 0);
		if (this.faces.length > 0) {
			this.faces.forEach((f) => {
				this.midPoint.add(f.midPoint);
			});
			this.midPoint.scaleInPlace(1 / this.faces.length);
		}
	}

	public addFace (f: Face) {
		if (!this.startingPoint) {
			this.startingPoint = f.midPoint;
		}
		if (this.faces.indexOf(f) == -1) {
			this.faces.push(f);
			this.setMidPoint();
		}
		f.region = this;
	};

	public removeFace (f: Face) {
		let idx = this.faces.indexOf(f);
		if (idx != -1) {
			this.faces.splice(idx, 1);
			this.setMidPoint();
		}
		if (f.region == this) {
			f.region = null;
		}
	};

	public addNeighbor (region: Region) {
		if (this.neighbors.indexOf(region) == -1) {
			this.neighbors.push(region);
			return true;
		} else {
			return false;
		}
	};

	public removeNeighbor (region: Region) {
		let idx;
		
		idx = this.neighbors.indexOf(region);
		if (idx >= 0) {
			this.neighbors.splice(idx, 1);
			return true;
		} else {
			return false;
		}
	};

	public eatRegion (eaten: Region) {
		let reg = this;
		if (eaten) {
			eaten.eaten = true;
			eaten.faces.forEach((f) => {
				this.addFace(f);
			});

			// remove from list of neighbors
			this.removeNeighbor(eaten);

			// add eaten region's neighbors
			eaten.neighbors.forEach((n) => {
				if (n != reg && this.addNeighbor(n)) {
					// remove eaten from neighbor's list of neighbors, replace with consumer
					n.removeNeighbor(eaten);
					n.addNeighbor(reg);
				}
			});

			// eating a coastal region makes me coastal
			if (eaten.coastal) {
				this.coastal = true;
			}
		}
	};

	public findNeighbors () {
		let reg = this;
		this.faces.forEach((face) => {
			face.connectedFaces.forEach((f) => {
				if (f.cellType != 'water' && f.region != reg) {
					this.addNeighbor(f.region);
				}
			});
		});
	};

	public setColor (color: number[]) {
		let reg = this;
		this.color = color;
		this.faces.forEach((f) => {
			f.color = reg.color;
		});
	};
};

export function createRegions (faces: Face[], tfSettings: TerraformSettings) {
	let regions: Region[] = [ ];
	let uneaten: Region[];
	let moreToEat: boolean;

	// Make a region for every non-water face
	faces.forEach((f) => {
		if (f.cellType != 'water') {
			let r = new Region();
			r.addFace(f);
			regions.push(r);
		}
	});

	// find neighboring regions based on edge connections
	regions.forEach((r) => {
		r.findNeighbors();
	});

	// determine which regions are coastal.
	regions.forEach((r) => {
		if (r.faces.some((f) => {
			if (f.connectedFaces.some((cf) => {
				if (cf.cellType == 'water') {
					return true;
				}
			})) {
				return true;
			}
		})) {
			r.coastal = true;
		}
	});

	let regionCmp = (a: Region, b: Region, r: Region) => {
		return r.startingPoint.subtract(b.startingPoint).lengthSquared() - r.startingPoint.subtract(a.startingPoint).lengthSquared();
	};

	interface Merger {
		consumer: Region;
		eaten: Region;
		border: number;
	}

	let retries = 1;
	let regionsUnite = () => {
		let prevRL = regions.length;
		let i;

		// set region midpoints
		regions.forEach((r) => {
			let pt = new BABYLON.Vector3(0, 0, 0);

			r.faces.forEach((f) => {
				pt.addInPlace(f.midPoint);
			});

			pt.scaleInPlace(1 / r.faces.length);
			r.midPoint = pt;
		});

		rand.shuffle(regions);
		
		let possibleMergers: Merger[] = [ ];

		regions.forEach((r) => {
			let edible: Region[] = [ ];
			let bigger: Region[] = [ ];
			let eaten;
			let consumer;
			let chanceBestMatch = 1.0;
			let pickBestMatch = true;

			// if I've been eaten, don't eat anybody else or
			// try to get eaten.
			if (r.eaten) {
				return;
			}

			if (Math.random() <= chanceBestMatch) {
				pickBestMatch = true;
			}

			r.neighbors.forEach((n) => {
				if (!n.eaten && n.faces.length <= r.faces.length && n.faces.length < tfSettings.safeSize) {
					edible.push(n);
				}
				if (!n.eaten && r.faces.length < tfSettings.safeSize && n.faces.length >= r.faces.length) {
					bigger.push(n);
				}
			});

			if (edible.length > 0) {
				rand.shuffle(edible);
				if (pickBestMatch) {
					edible.sort((a: Region, b: Region) => { return regionCmp(a, b, r) });
				}
				eaten = edible[0];
				consumer = r;
			} else {
				rand.shuffle(bigger);
				if (pickBestMatch) {
					bigger.sort((a: Region, b:Region) => { return regionCmp(a, b, r) });
				}
				eaten = r;
				consumer = bigger[0];
			}

			if (consumer && eaten) {
				possibleMergers.push({consumer: consumer, eaten: eaten, border: regionMeasureBorder(consumer, eaten)});
			}
		});

		possibleMergers.sort(function (a, b) {
			return a.border - b.border;
		});

		// pick only the best possible mergers
		let toMerge = 0;
		
		if (possibleMergers.length < 100) {
			toMerge = possibleMergers.length;
		} else {
			toMerge = possibleMergers.length / 10;
		}

		for (i=0; i <= toMerge; i++) {
			let m = possibleMergers[i];
			if (m) {
				if (!m.consumer.eaten && !m.eaten.eaten) {
					m.consumer.eatRegion(m.eaten);
				}
			}
		}

		uneaten = [ ];
		moreToEat = false;
		
		regions.forEach(function (r) {
			if (!r.eaten) {
				uneaten.push(r);
				if (!moreToEat && r.neighbors.length > 0 && r.faces.length < tfSettings.safeSize) {
					moreToEat = true;
				}
			}
		});

		regions = uneaten;
		if (!moreToEat) {
			return;
		}

		if (regions.length == prevRL) {
			return;
		} else {
			if (regions.length == prevRL) {
				retries++;
			}
			prevRL = regions.length;
		}

		retries++;
		if (retries > 100) {
			return;
		}

		regionsUnite();
	};

	regionsUnite();

	// un-neighbor eaten regions
	regions.forEach(function (region) {
		let neighbors: Region[] = [ ];
		region.neighbors.forEach(function (neighbor) {
			if (!neighbor.eaten) {
				neighbors.push(neighbor);
			}
		});
		region.neighbors = neighbors;
	});

	// make sure midpoints are actually inside region boundries.
	// if that's not the case, it looks strange to be drawing arrows
	// that actually appear to originate outside the region.
	regions.forEach(function (region) {
		let min_dist: number;
		let closest: BABYLON.Vector3;

		region.faces.forEach(function (face) {
			let dsq = face.midPoint.subtract(region.midPoint).lengthSquared();
			if (min_dist === undefined || dsq < min_dist) {
				closest = face.midPoint;
				min_dist = dsq;
			}
		});

		region.midPoint = closest.clone();
	});

	return regions;
};

function regionMeasureBorder (r: Region, r2: Region) {
	let neighboringFaces = 0;

	r.faces.forEach(function (face) {
		face.connectedFaces.forEach(function (cf) {
			if (cf.region != r && cf.cellType != 'water' && cf.region != r2) {
				neighboringFaces++;
			}
		});
	});

	if (r2) {
		r2.faces.forEach(function (face) {
			face.connectedFaces.forEach(function (cf) {
				if (cf.region != r2 && cf.cellType != 'water' && cf.region != r) {
					neighboringFaces++;
				}
			});
		});
	}

	return neighboringFaces;
};

function findNearestRegionToIsland (region: Region, maxSteps: number) {
	let facesToCheck = region.faces;
	let facesChecked: Face[] = [ ];
	
	// start with faces that border water
	facesToCheck = region.faces.filter(function (f) {
		return f.connectedFaces.some(function (cf) {
			return cf.cellType == 'water';
		});
	});

	for (let step=0; step < maxSteps; step++) {
		let nextToCheck: Face[] = [ ];
		for (let i=0; i < facesToCheck.length; i++) {
			let f = facesToCheck[i];
			facesChecked.push(f);
			if (f.cellType == 'water' || f.region == region) {
				f.connectedFaces.forEach(function (cf) {
					if (facesChecked.indexOf(cf) == -1 && nextToCheck.indexOf(cf) == -1 && cf.region != region) {
						nextToCheck.push(cf);
					}
				});
			} else {
				return f.region;
			}
		}
		facesToCheck = nextToCheck;
	}
};

export function claimIslands (planet: Planet, regionsIn: Region[], tfSettings: TerraformSettings) {
	let allRegions: Region[] = regionsIn;
	let regions = regionsIn.slice();
	let smallRegions: Region[] = [ ];

	while (true) {
		let consumers: Region[] = [ ];

		// find tiny islands
		regions.forEach(function (region) {
			if (!region.eaten && region.faces.length < tfSettings.islandSafeSize) {
				smallRegions.push(region);
			}
		});

		// find nearest regions
		smallRegions.forEach(function (region) {
			let closestRegion: Region;
			if (!region.eaten) {
				closestRegion = findNearestRegionToIsland(region, tfSettings.islandNeighborhoodRadius);
				if (closestRegion) {
					if (closestRegion.faces.length > region.faces.length) {
						closestRegion.eatRegion(region);
					} else {
						region.eatRegion(closestRegion);
						consumers.push(region);
					}
				} else {
					if (region.faces.length < tfSettings.islandKillSize) {
						region.eaten = true;
						region.faces.forEach(function (face) {
							planet.faceWaterify(face);
						});
					}
				}
			}
		});

		if (consumers.length == 0) {
			break;
		}

		// limit list to thost regions that ate other regions, and so didn't have
		// a chance to get eaten by larger ones
		regions = consumers;
	}

	// find uneaten regions
	regions = allRegions.filter(function (region) {
		return !region.eaten;
	});

	return regions;
};