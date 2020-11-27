export const setBoundaryVelocitiesShader = {
    
/* ---------------------------------------------------------------------------- */
/* ----------------------------- setBoundaryVelocities ------------------------ */
/* ---------------------------------------------------------------------------- */
  setBoundaryVelocities: (numPArg: number, numGArg: number) => `#version 450
  layout(std140, set = 0, binding = 0) uniform SimParams {
    float dt; // Timestep
    float gravityX;  // Gravity (x-component)
    float gravityY;  // Gravity (y-component)
    float gravityZ;  // Gravity (z-component)
    float minCornerX; // Min corner of the grid (x-component) (also works as the origin of the grid for offsetting purposes)
    float minCornerY; // Min corner of the grid (y-component) (also works as the origin of the grid for offsetting purposes)
    float minCornerZ; // Min corner of the grid (z-component) (also works as the origin of the grid for offsetting purposes)
    float maxCornerX;  // Max corner of the grid (x-component)
    float maxCornerY;  // Max corner of the grid (y-component)
    float maxCornerZ;  // Max corner of the grid (z-component)
    float h; // Cell width of the grid
    float nxG;  // Number of grid points in the x-direction
    float nyG;  // Number of grid points in the y-direction
    float nzG;  // Number of grid points in the z-direction
    float numG; // Total number of grid points
    float E;  // Young's Modulus (Hardness)
    float E0; // Initial Young's Modulus (for snow)
    float nu; // Poisson's Ratio (Incompressibility)
    float nuSnow; // Poisson's Ratio (for snow)
    float thetaC; // Critical compression (for snow)
    float thetaS;  // Critical stretch (for snow)
    float xi;  // Hardening coefficient (for snow)
    float mu;  // One of the Lamé parameters
    float lambda;  // One of the Lamé parameters
    float lambdaFluid; // parameter for fluid
    float gamma;  // parameter for fluid
    float rhoJello;  // Density of the points' material for jello
    float rhoSnow;  // Density of the points' material for snow
    float rhoFluid; // Density of the points' material for fluid
    float numP;  // Total number of points
    float PADDING_1; // IGNORE
    float PADDING_2; // IGNORE
  } params;
  struct ParticleStruct1 {
    vec4 pos; // (pos.xyz => Particle Position, pos.w => Particle Material Type)
    vec4 v; // (v.xyz => Particle Velocity, v.w => Particle Mass)
  };
  struct ParticleStruct2 {
    mat3 F; // Deformation Graident Of The Particle
    mat3 Fe;  // Elastic Component Of The Deformation Gradient Of The Particle
    mat3 Fp;  // Plastic Component Of The Deformation Gradient Of The Particle
    mat3 C; // APIC's C Matrix Of The Particle
    float J;  // J attribute Of The Particle
    float vol;  // Volume Of The Particle
    float PADDING_1;  // (IGNORE)
    float PADDING_2;  // (IGNORE)
  };
  struct GridNodeStruct {
    vec3 vN;  // New Velocity Stored On The Grid Node
    vec3 v; // Old Velocity Stored On The Grid Node
    vec3 force; // Force Stored On The Grid Node
    float m;  // Mass Stored On The Grid Node
    float PADDING_1;  // (IGNORE)
    float PADDING_2;  // (IGNORE)
    float PADDING_3;  // (IGNORE)
  };
  layout(std430, set = 0, binding = 1) buffer PARTICLES1 {
    ParticleStruct1 data[${numPArg}];
  } particles1;
  layout(std430, set = 0, binding = 2) buffer PARTICLES2 {
    ParticleStruct2 data[${numPArg}];
  } particles2;
  layout(std430, set = 0, binding = 3) buffer GRIDNODES {
    GridNodeStruct data[${numGArg}];
  } gridNodes;
  int coordinateToId(ivec3 c) {
    return c[0] + int(params.nxG) * c[1] + int(params.nxG) * int(params.nyG) * c[2];
  }
  void main() {
    uint indexI = gl_GlobalInvocationID.x;
    uint indexJ = gl_GlobalInvocationID.y;
    uint indexK = gl_GlobalInvocationID.z;
    if (indexI >= params.nxG || indexJ >= params.nyG || indexK >= params.nzG) { return; }
    
    int baseNodeI = int(indexI);
    int baseNodeJ = int(indexJ);
    int baseNodeK = int(indexK);
    int nodeID = coordinateToId(ivec3(baseNodeI, baseNodeJ, baseNodeK));
    // Setting Boundary Velocities To Zero
    int thickness = 3;  // Change the thickness parameter here
    // Bottom (non-sticky)
    if (baseNodeJ < thickness) {
      gridNodes.data[nodeID].vN.y = 0.0;
    }
    // Left (non-sticky)
    if (baseNodeI < thickness) {
      gridNodes.data[nodeID].vN.x = 0.0;
    }
    // Right (non-sticky)
    if (baseNodeI >= params.nxG - thickness) {
      gridNodes.data[nodeID].vN.x = 0.0;
    }
    // Back (non-sticky)
    if (baseNodeK < thickness) {
      gridNodes.data[nodeID].vN.z = 0.0;
    }
    // Front (non-sticky)
    if (baseNodeK >= params.nzG - thickness) {
      gridNodes.data[nodeID].vN.z = 0.0;
    }
    // Top (sticky)
    if (baseNodeJ >= params.nyG - thickness) {
      gridNodes.data[nodeID].vN = vec3(0.0);
    }
    // Test Speed
    if (nodeID < ${numPArg}) {
      particles1.data[nodeID].pos += vec4(vec3(0, 0.01, 0), 0);
    }
  }`,
};