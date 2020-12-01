import { Vector3 } from 'three';

// Simulation Parameters
export const dt = 0.001; // Timestep
export const gravity  = new Vector3(0.0, -9.8, 0.0);  // Gravity

 // Grid Parameters
export const minCorner = new Vector3(-1.0, -1.0, -1.0); // Min corner of the grid (also works as the origin of the grid for offsetting purposes)
export const maxCorner = new Vector3(1.0, 1.0, 1.0);  // Max corner of the grid
export const h = 0.08; // Cell width of the grid
export const nxG = Math.floor((maxCorner.x - minCorner.x) / h) + 1;  // Number of grid points in the x-direction
export const nyG = Math.floor((maxCorner.y - minCorner.y) / h) + 1;  // Number of grid points in the y-direction
export const nzG = Math.floor((maxCorner.z - minCorner.z) / h) + 1;  // Number of grid points in the z-direction
export const numG = nxG * nyG * nzG; // Total number of grid points

// Particle Attributes
export const E = 10000.0;  // Young's Modulus (Hardness)
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
export const numP = 1000; // 64;  // Total number of points

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


  // Particle Position (3 floats) (First vec4)
  // Particle Material Type (1 float) (First vec4)
  // Particle Velocity (3 floats) (Second vec4)
  // Particle Mass (1 float) (Second vec4)
  export const p1Data = new Float32Array(numP * 8);
  
  // Deformation Graident Of The Particle (12 floats)
  // Elastic Component Of The Deformation Gradient Of The Particle (12 floats)
  // Plastic Component Of The Deformation Gradient Of The Particle (12 floats)
  // APIC's C Matrix Of The Particle (12 floats)
  // J attribute Of The Particle (1 float)
  // Volume Of The Particle (1 float)
  // Padding to match the 4 floats alignment (1 float)
  // Padding to match the 4 floats alignment (1 float)
  export const p2Data = new Float32Array(numP * 52);

  // New Velocity Stored On The Grid Node (4 floats)
  // Old Velocity Stored On The Grid Node (4 floats)
  // Force Stored On The Grid Node (4 floats)
  // Mass Stored On The Grid Node (1 float)
  // Padding to match the 4 floats alignment (1 float)
  // Padding to match the 4 floats alignment (1 float)
  // Padding to match the 4 floats alignment (1 float)
  export const gData = new Float32Array(numG * 16);


  let matIdentity : number[] = [1, 0, 0, 0,/*Col 1*/ 0, 1, 0, 0,/*Col 2*/ 0, 0, 1, 0/*Col 3*/];
  let volumeP = h * h * h / 8.0;
  for (let i = 0; i < numP; i++) {
    // Fill in p1Data
    let matType = 0;
    let mass = 0;
    switch (matType) {
      case 0:
        mass = volumeP * rhoJello;
        break;
      case 1:
        mass = volumeP * rhoSnow;
        break;
      case 2:
        mass = volumeP * rhoFluid;
        break;  
    }

    p1Data[8 * i + 0] = Math.random() * 2 - 1; // Math.random() * (2 * h) - h;  // Particle Position X Component (1 float)
    p1Data[8 * i + 1] = Math.random() * 2 - 1; // Math.random() * (2 * h) + 0.65;  // Particle Position Y Component (1 float)
    p1Data[8 * i + 2] = Math.random() * 2 - 1; // Math.random() * (2 * h) - h;  // Particle Position Z Component (1 float)
    p1Data[8 * i + 3] = matType;  // Particle Material Type (1 float)
    p1Data[8 * i + 4] = 0;  // Particle Velocity X Component (1 float)
    p1Data[8 * i + 5] = 0;  // Particle Velocity Y Component (1 float)
    p1Data[8 * i + 6] = 0;  // Particle Velocity Z Component (1 float)
    p1Data[8 * i + 7] = mass; // Particle Mass (1 float)

    // Fill in p2Data
    for (let matrixIndex = 0; matrixIndex < 12; matrixIndex++) {
      p2Data[52 * i + matrixIndex] = matIdentity[matrixIndex]; // Deformation Graident Of The Particle (12 floats)
      p2Data[52 * i + 12 + matrixIndex] = matIdentity[matrixIndex]; // Elastic Component Of The Deformation Gradient Of The Particle (12 floats)
      p2Data[52 * i + 24 + matrixIndex] = matIdentity[matrixIndex];  // Plastic Component Of The Deformation Gradient Of The Particle (12 floats)
      p2Data[52 * i + 36 + matrixIndex] = matIdentity[matrixIndex];  // APIC's C Matrix Of The Particle (12 floats)
    }

    p2Data[52 * i + 48] = 1.0;  // J attribute Of The Particle (1 float)
    p2Data[52 * i + 49] = volumeP;  // Volume Of The Particle (1 float)
    p2Data[52 * i + 50] = 0;  // Padding to match the 4 floats alignment (1 float)
    p2Data[52 * i + 51] = 0;  // Padding to match the 4 floats alignment (1 float)
  }

  for (let i = 0; i < numG; i++) {
    // Fill in gData
    gData[16 * i + 0] = 0;  // New Velocity Stored On The Grid Node (X Component) (1 float)
    gData[16 * i + 1] = 0;  // New Velocity Stored On The Grid Node (Y Component) (1 float)
    gData[16 * i + 2] = 0;  // New Velocity Stored On The Grid Node (Z Component) (1 float)
    gData[16 * i + 3] = 0;  // PADDING (1 float)
    gData[16 * i + 4] = 0;  // Old Velocity Stored On The Grid Node (X Component) (1 float)
    gData[16 * i + 5] = 0;  // Old Velocity Stored On The Grid Node (Y Component) (1 float)
    gData[16 * i + 6] = 0;  // Old Velocity Stored On The Grid Node (Z Component) (1 float)
    gData[16 * i + 7] = 0;  // PADDING (1 float)
    gData[16 * i + 8] = 0;  // Force Stored On The Grid Node (X Component) (1 float)
    gData[16 * i + 9] = 0;  // Force Stored On The Grid Node (Y Component) (1 float)
    gData[16 * i + 10] = 0;  // Force Stored On The Grid Node (Z Component) (1 float)
    gData[16 * i + 11] = 0;  // // Mass Stored On The Grid Node (1 float)
    gData[16 * i + 12] = 0;  // PADDING (1 float)
    gData[16 * i + 13] = 0;  // PADDING (1 float)
    gData[16 * i + 14] = 0;  // PADDING (1 float)
    gData[16 * i + 15] = 0;  // PADDING (1 float)
  }