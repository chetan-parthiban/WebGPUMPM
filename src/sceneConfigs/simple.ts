import { Vector3, Euler } from 'three';
import {toVec3s, transformVec3, createParticleArray, mergeParticleArrays, ilog2ceil, getNumGPadded, models, materials, fillP2Data} from '../utilities/configParser'


// Scene Definition
let scene_models : Float32Array[] = [models.amongUs];
let scene_scales : number[]       = [0.5];
let scene_rots   : Euler[]        = [new Euler(0.0,0.0,0.0)];
let scene_translate : Vector3[]   = [new Vector3(0.0,0.0,0.0)];
let scene_materials : number[]    = [materials.snow];
let scene_velocities : Vector3[]  = [new Vector3(10.0,0,0)];

// Benchmarking Parameters
export const doBenchmark = false;
export const queryLength = 18;

// Simulation Parameters
export const dt = 0.001; // Timestep
export const gravity  = new Vector3(0.0, -9.8, 0.0);  // Gravity

 // Grid Parameters
export const minCorner = new Vector3(-1.0, -1.0, -1.0); // Min corner of the grid (also works as the origin of the grid for offsetting purposes)
export const maxCorner = new Vector3(1.0, 1.0, 1.0);  // Max corner of the grid
export const h = 0.04; // Cell width of the grid

// Particle Attributes
export const E = 15000.0;  // Young's Modulus (Hardness)
export const E0 = 14000; // Initial Young's Modulus (for snow)
export const nu = 0.3; // Poisson's Ratio (Incompressibility)
export const nuSnow = 0.2; // Poisson's Ratio (for snow)
export const thetaC = 0.025; // Critical compression (for snow)
export const thetaS = 0.0075;  // Critical stretch (for snow)
export const xi = 10.0;  // Hardening coefficient (for snow)
export const mu = E / (2.0 * (1.0 + nu));  // One of the Lamé parameters
export const lambda = E * nu / ((1.0 + nu) * (1.0 - 2.0 * nu));  // One of the Lamé parameters
export const lambdaFluid = 10; // parameter for fluid
export const gamma = 7;  // parameter for fluid
export const rhoJello = 1000.0;  // Density of the points' material for jello
export const rhoSnow = 400;  // Density of the points' material for snow
export const rhoFluid = 997; // Density of the points' material for fluid

//////////////////////////////////////////////////////////////////////////////////////////
///*************** DO NOT CHANGE BELOW HERE FOR PROPER SCENE GENERATION ***************///
//////////////////////////////////////////////////////////////////////////////////////////

// compute remaining grid parameters and export grid
export const nxG = Math.floor((maxCorner.x - minCorner.x) / h) + 1;  // Number of grid nodes in the x-direction
export const nyG = Math.floor((maxCorner.y - minCorner.y) / h) + 1;  // Number of grid nodes in the y-direction
export const nzG = Math.floor((maxCorner.z - minCorner.z) / h) + 1;  // Number of grid nodes in the z-direction
export const numG = nxG * nyG * nzG; // Total number of grid nodes
export const numGPadded = getNumGPadded(numG); // Total number of grid nodes but padded with 0s (For stream compaction purposes)
export const sweepIters = ilog2ceil(numGPadded) - 1;  // Number of iterations to iterate over in up sweep and down sweep in stream compaction

export const gData = new Float32Array(numG * 16);
export const gSCData = new Float32Array(numGPadded * 4);

// compute the remaining particle parameters and export p1Data particle buffer
let volumeP = h * h * h / 8.0;
let materialMasses : number[] = [volumeP * rhoJello, volumeP * rhoSnow, volumeP * rhoFluid];
let particleArrays : Array<Float32Array> = Array(scene_models.length);
let materialCounters = [0,0,0];
for(let i = 0; i < scene_models.length; i++) {
    let modelVec3 = toVec3s(scene_models[i]);
    modelVec3 = transformVec3(modelVec3, scene_rots[i], scene_translate[i], scene_scales[i], h); 
    particleArrays[i] = createParticleArray(modelVec3, scene_materials[i], scene_velocities[i], materialMasses[Math.floor(scene_materials[i])]);
    materialCounters[Math.floor(scene_materials[i])] += modelVec3.length;
}
export const p1Data = mergeParticleArrays(particleArrays);
export const numPJello = materialCounters[0]; 
export const numPSnow = materialCounters[1]; 
export const numPFluid = materialCounters[2];  
export const numP = numPJello + numPSnow + numPFluid; // Total number of points  

// create, initialize, and export p2Data buffer
export const p2Data = new Float32Array(numP * 52);
fillP2Data(p2Data, numP, volumeP);

// create and export simParamData Buffer
export const simParamData = new Float32Array([
    dt, // Timestep
    gravity.x,  // Gravity (x-component)
    gravity.y,  // Gravity (y-component)
    gravity.z,  // Gravity (z-component)
    minCorner.x, // Min corner of the grid (x-component) (also works as the origin of the grid for offsetting purposes)
    minCorner.y, // Min corner of the grid (y-component) (also works as the origin of the grid for offsetting purposes)
    minCorner.z, // Min corner of the grid (z-component) (also works as the origin of the grid for offsetting purposes)
    maxCorner.x,  // Max corner of the grid (x-component)
    maxCorner.y,  // Max corner of the grid (y-component)
    maxCorner.z,  // Max corner of the grid (z-component)
    h, // Cell width of the grid
    nxG,  // Number of grid points in the x-direction
    nyG,  // Number of grid points in the y-direction
    nzG,  // Number of grid points in the z-direction
    numG, // Total number of grid points
    E,  // Young's Modulus (Hardness)
    E0, // Initial Young's Modulus (for snow)
    nu, // Poisson's Ratio (Incompressibility)
    nuSnow, // Poisson's Ratio (for snow)
    thetaC, // Critical compression (for snow)
    thetaS,  // Critical stretch (for snow)
    xi,  // Hardening coefficient (for snow)
    mu,  // One of the Lamé parameters
    lambda,  // One of the Lamé parameters
    lambdaFluid, // parameter for fluid
    gamma,  // parameter for fluid
    rhoJello,  // Density of the points' material for jello
    rhoSnow,  // Density of the points' material for snow
    rhoFluid, // Density of the points' material for fluid
    numP,  // Total number of points
    0, // For padding purposes (IGNORE)
    0 // For padding purposes (IGNORE)
]);
  
// log some scene statistics
console.log("Number Of Jello Particles: " + numPJello.toString());
console.log("Number Of Snow Particles: " + numPSnow.toString());
console.log("Number Of Fluid Particles: " + numPFluid.toString());
console.log("Total Number Of Particles: " + numP.toString());
console.log("Total Number of Grid Cells: "+ numG.toString());