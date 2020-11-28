export const g2pShader = {
      /* -------------Example For Adding "Kernel"/Compute Shader (Part 3)------------------- */
g2p: (numPArg: number, numGArg: number) => `#version 450
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
// Compute weights (when each thread handles a particle)
void computeWeights1D_P(float x, out vec3 w, out vec3 dw, out int baseNode) {
  // x is the particle's index-space position and can represent particle's index-space position in x, y, or z direction,
  // baseNode can also represent the baseNode in x, y, or z direction, depending on how this function is used
  // Note that here we compute the 1D quadratic B spline weights and
  // x is assumed to be scaled in the index space (in other words, the grid has cell width of length 1)
  baseNode = int(floor(x - 0.5));
  float d0 = x - baseNode;
  w[0] = 0.5 * (1.5 - d0) * (1.5 - d0);
  dw[0] = d0 - 1.5;
  float d1 = x - (baseNode + 1);
  w[1] = 0.75 - d1 * d1;
  dw[1] = -2 * d1;
  float d2 = x - (baseNode + 2);
  w[2] = 0.5 * (1.5 + d2) * (1.5 + d2);
  dw[2] = 1.5 + d2;
}
int coordinateToId(ivec3 c) {
  return c[0] + int(params.nxG) * c[1] + int(params.nxG) * int(params.nyG) * c[2];
}
void main() {
  uint index = gl_GlobalInvocationID.x;
  if (index >= ${numPArg}) { return; }
  // loop through the nearby 3*3*3 grids
  vec3 minCorner = vec3(params.minCornerX, params.minCornerY, params.minCornerZ);
  vec3 posP_index_space = (particles1.data[index].pos.xyz - minCorner) / params.h;
  vec3 wI, wJ, wK;
  vec3 dwI, dwJ, dwK;
  int baseNodeI, baseNodeJ, baseNodeK;
  computeWeights1D_P(posP_index_space.x, wI, dwI, baseNodeI);
  computeWeights1D_P(posP_index_space.y, wJ, dwJ, baseNodeJ);
  computeWeights1D_P(posP_index_space.z, wK, dwK, baseNodeK);
  vec3 vP_PIC = vec3(0.0);
  vec3 vP_FLIP = particles1.data[index].v.xyz;
  mat3 CMat = mat3(0.0);
  
  for (int k = 0; k < 3; k++) {
    for (int j = 0; j < 3; j++) {
        for (int i = 0; i < 3; i++) {
            int nodeI = baseNodeI + i;
            int nodeJ = baseNodeJ + j;
            int nodeK = baseNodeK + k;
            int nodeID = coordinateToId(ivec3(nodeI, nodeJ, nodeK));
            float weightIJK = wI[i] * wJ[j] * wK[k];
            
            vP_PIC += gridNodes.data[nodeID].vN * weightIJK;
            // if not APIC:
            vP_FLIP += (gridNodes.data[nodeID].vN - gridNodes.data[nodeID].v) * weightIJK;
            // // if APIC: ignore at the moment -- below is APIC stuff
            // vec3 posG = vec3(float(nodeI), float(nodeJ), float(nodeK)) * params.h + minCorner;
            // CMat += (weightIJK * 4.0 / (params.h * params.h)) * outerProduct(gridNodes.data[nodeID].vN, (posG - particles1.data[index].pos.xyz));
        }
    }
  }
  
  // if not APIC:
  float flipPercentage = 0.95;
  particles1.data[index].v.xyz = (1.0 - flipPercentage) * vP_PIC + flipPercentage * vP_FLIP;
  // // if APIC: ignore apic for now -- below is APIC code
  // particles1.data[index].v.xyz = vP_PIC.xyz;
  // particles2.data[index].C = CMat;
  particles1.data[index].pos.xyz += params.dt * vP_PIC.xyz;
}`
};
