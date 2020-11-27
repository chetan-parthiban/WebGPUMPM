export const p2gShader = {
    compute: (numPArg: number, numGArg: number) => `#version 450
  
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
  
  
  int coordinateToId(int x, int y, int z) {
    return x + int(params.nxG) * y + int(params.nxG) * int(params.nyG) * z;
  }
  
// Compute weights (when each thread handles a grid node) (Version 1: Tested)
void computeWeights1D_G(int node, float x, out float w) {
  // x is the particle's index-space position and can represent particle's index-space position in x, y, or z direction,
  // x is assumed to be scaled in the index space (in other words, the grid has cell width of length 1)
  // node is the grid node's coordinate in x, y, or z direction in index space
  float d = x - node;
  if (abs(d) < 1.5) {
    if (d >= 0.5 && d < 1.5) {  // [0.5, 1.5)
      w = 0.5 * (1.5 - d) * (1.5 - d);
    } else if (d > -0.5 && d < 0.5) { // (-0.5, 0.5)
      w = 0.75 - d * d;
    } else {  // (-1.5, -0.5]
      w = 0.5 * (1.5 + d) * (1.5 + d);
    }
  } else {
    w = 0;
  }
}


void main() {
    int baseNodeI = int(gl_GlobalInvocationID.x);
    int baseNodeJ = int(gl_GlobalInvocationID.y);
    int baseNodeK = int(gl_GlobalInvocationID.z);
    if (baseNodeI >= params.nxG || baseNodeJ >= params.nyG || baseNodeK >= params.nzG) { return; }
    
    float m = 0;
    vec3 v = vec3(0,0,0);
    vec3 minCorner = vec3(params.minCornerX, params.minCornerY, params.minCornerZ);
    // vec3 posG = vec3(baseNodeI, baseNodeJ, baseNodeK) * params.h + minCorner;
    for (int p = 0; p < ${numPArg}; p++) {
        vec3 posP_index_space = (particles1.data[p].pos.xyz - minCorner) / params.h;
        
        float wI, wJ, wK;
        computeWeights1D_G(baseNodeI, posP_index_space.x, wI);
        computeWeights1D_G(baseNodeJ, posP_index_space.y, wJ);
        computeWeights1D_G(baseNodeK, posP_index_space.z, wK);
        
        float weight = wI * wJ * wK * particles1.data[p].v.w; // check w/ jacky

        m += weight; 
        v += weight * particles1.data[p].v.xyz;
        // v += weight * (particles1.data[p].v.xyz + particles2.data[p].C * (posG - particles1.data[p].pos.xyz));
    }

    int nodeID = coordinateToId(baseNodeI, baseNodeJ, baseNodeK);
    gridNodes.data[nodeID].m = m;
    gridNodes.data[nodeID].v = v;
}`,
};