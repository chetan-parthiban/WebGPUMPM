export const sortingShader = {

  reduce: (numPArg: number, numGArg: number) => `#version 450
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

  layout(std140, set = 0, binding = 1) uniform SortParameters {
    int step; 
    float PADDING_1; // IGNORE
    float PADDING_2; // IGNORE
    float PADDING_3; // IGNORE
  } sortParams;

  struct GridNodeStruct {
    vec3 vN;  // New Velocity Stored On The Grid Node
    vec3 v; // Old Velocity Stored On The Grid Node
    vec3 force; // Force Stored On The Grid Node
    float m;  // Mass Stored On The Grid Node
    float PADDING_1;  // (IGNORE)
    float PADDING_2;  // (IGNORE)
    float PADDING_3;  // (IGNORE)
  };

  layout(std430, set = 0, binding = 2) buffer GRIDNODES {
    GridNodeStruct data[${numGArg}];
  } gridNodes;

  layout(std430, set = 0, binding = 3) buffer REDUCEBUFFER {
    int data[${numGArg}];
  } reductionBuffer;

  void main() {
    if (sortParams.step == 1) {
        int index = gl_GlobalInvocationID.x;
        if (index > ${numGArg}) { return; }
        reductionBuffer.data[index] = int(gridNodes.data[index].m > 0);
    }
    else {
        int index = ((gl_GlobalInvocationID.x+1) * sortParams.step) - 1;
        if (index > ${numGArg}) { return; }
        reductionBuffer.data[index] += reductionBuffer.data[index - sortParams.step / 2];
    }
  }`,



};