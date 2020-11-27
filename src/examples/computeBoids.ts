import { debug } from 'webpack';
import glslangModule from '../glslang';
import { mat4, vec3, vec4} from 'gl-matrix';
import { Vector3, Vector4, Matrix3, Matrix4 } from 'three';

export const title = 'Compute Boids';
export const description = 'A GPU compute particle simulation that mimics \
                            the flocking behavior of birds. A compute shader updates \
                            two ping-pong buffers which store particle data. The data \
                            is used to draw instanced particles.';

export async function init(canvas: HTMLCanvasElement, useWGSL: boolean) {
  // console.log(JSON.stringify()); // For debugging purposes

  // Simulation Parameters
  const dt = 0.001; // Timestep
  const gravity  = new Vector3(0.0, -9.8, 0.0);  // Gravity

  // Grid Parameters
  const minCorner = new Vector3(-1.0, -1.0, -1.0); // Min corner of the grid (also works as the origin of the grid for offsetting purposes)
  const maxCorner = new Vector3(1.0, 1.0, 1.0);  // Max corner of the grid
  const h = 0.5; // Cell width of the grid
  const nxG = Math.floor((maxCorner.x - minCorner.x) / h) + 1;  // Number of grid points in the x-direction
  const nyG = Math.floor((maxCorner.y - minCorner.y) / h) + 1;  // Number of grid points in the y-direction
  const nzG = Math.floor((maxCorner.z - minCorner.z) / h) + 1;  // Number of grid points in the z-direction
  const numG = nxG * nyG * nzG; // Total number of grid points

  // debug print
  console.log(nxG, nyG, nzG);

  // Particle Attributes
  const E = 10000.0;  // Young's Modulus (Hardness)
  const E0 = 14000; // Initial Young's Modulus (for snow)
  const nu = 0.3; // Poisson's Ratio (Incompressibility)
  const nuSnow = 0.2; // Poisson's Ratio (for snow)
  const thetaC = 0.025; // Critical compression (for snow)
  const thetaS = 0.0075;  // Critical stretch (for snow)
  const xi = 10.0;  // Hardening coefficient (for snow)
  const mu = E / (2.0 * (1.0 + nu));  // One of the Lamé parameters
  const lambda = E * nu / ((1.0 + nu) * (1.0 - 2.0 * nu));  // One of the Lamé parameters
  const lambdaFluid = 10; // parameter for fluid
  const gamma = 7;  // parameter for fluid
  const rhoJello = 1000.0;  // Density of the points' material for jello
  const rhoSnow = 400;  // Density of the points' material for snow
  const rhoFluid = 997; // Density of the points' material for fluid
  const numP = 4000;  // Total number of points


  // Calling navigator.gpu.requestAdapter() returns a JavaScript promise
  // that will asynchronously resolve with a GPU adapter.
  // Think of this adapter as the graphics card.
  //    (await suspends the execution until an asynchronous function return promise 
  //    is fulfilled and unwraps the value from the Promise returned)
  const adapter = await navigator.gpu.requestAdapter();
  // Calling adapter.requestDevice() to get a promise that will 
  // resolve with a GPU device you’ll use to do some GPU computation
  const device = await adapter.requestDevice();
  const glslang = await glslangModule();

  const context = canvas.getContext('gpupresent');
  
  const swapChain = context.configureSwapChain({
    device,
    format: "bgra8unorm"
  });

  const renderPipeline = device.createRenderPipeline({
    vertexStage: {
      module: 
        device.createShaderModule({
          code: glslShaders.vertex,
          transform: (glsl) => glslang.compileGLSL(glsl, "vertex"),
        }),
      entryPoint: "main",
    },
    fragmentStage: {
      module: 
      device.createShaderModule({
          code: glslShaders.fragment,
          transform: (glsl) => glslang.compileGLSL(glsl, "fragment"),
        }),
      entryPoint: "main",
    },

    primitiveTopology: "point-list",

    depthStencilState: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus-stencil8",
    },

    vertexState: {
      vertexBuffers: [
        {
          // instanced particles buffer
          arrayStride: 8 * 4,
          stepMode: "instance",
          attributes: [
            {
              // instance position
              shaderLocation: 0,
              offset: 0,
              format: "float4",
            },
            {
              // instance velocity
              shaderLocation: 1,
              offset: 4 * 4,
              format: "float4",
            },
          ],
        },
      ],
    },

    colorStates: [
      {
        format: "bgra8unorm",
      },
    ],
  });

  const computePipeline = device.createComputePipeline({
    computeStage: {
      module: 
        device.createShaderModule({
            code: glslShaders.compute(numP, numG),
            transform: (glsl) => glslang.compileGLSL(glsl, "compute"),
          }),
      entryPoint: "main",
    },
  });

  /* -------------Example For Adding "Kernel"/Compute Shader (Part 1)------------------- */
  const g2pPipeline = device.createComputePipeline({
    computeStage: {
      module: 
        device.createShaderModule({
            code: glslShaders.g2p(numP, numG),
            transform: (glsl) => glslang.compileGLSL(glsl, "compute"),
          }),
      entryPoint: "main",
    },
  });
  // --------------------------------------------------------------------------------------


  const depthTexture = device.createTexture({
    size: { width: canvas.width, height: canvas.height, depth: 1 },
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.OUTPUT_ATTACHMENT
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [{
      attachment: undefined,  // Assigned later
      loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    }],
    depthStencilAttachment: {
      attachment: depthTexture.createView(),
      depthLoadValue: 1.0,
      depthStoreOp: "store",
      stencilLoadValue: 0,
      stencilStoreOp: "store",
    }
  };




  // uniform projection matrix for render pipeline
  const uniformBufferSize = 4 * 16; // 4x4 matrix

  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  });




  const simParamData = new Float32Array([
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
  const simParamBuffer = device.createBuffer({
    size: simParamData.byteLength,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });
  new Float32Array(simParamBuffer.getMappedRange()).set(simParamData);
  simParamBuffer.unmap();

  
  // Particle Position (3 floats) (First vec4)
  // Particle Material Type (1 float) (First vec4)
  // Particle Velocity (3 floats) (Second vec4)
  // Particle Mass (1 float) (Second vec4)
  const p1Data = new Float32Array(numP * 8);
  
  // Deformation Graident Of The Particle (12 floats)
  // Elastic Component Of The Deformation Gradient Of The Particle (12 floats)
  // Plastic Component Of The Deformation Gradient Of The Particle (12 floats)
  // APIC's C Matrix Of The Particle (12 floats)
  // J attribute Of The Particle (1 float)
  // Volume Of The Particle (1 float)
  // Padding to match the 4 floats alignment (1 float)
  // Padding to match the 4 floats alignment (1 float)
  const p2Data = new Float32Array(numP * 52);

  // New Velocity Stored On The Grid Node (4 floats)
  // Old Velocity Stored On The Grid Node (4 floats)
  // Force Stored On The Grid Node (4 floats)
  // Mass Stored On The Grid Node (1 float)
  // Padding to match the 4 floats alignment (1 float)
  // Padding to match the 4 floats alignment (1 float)
  // Padding to match the 4 floats alignment (1 float)
  const gData = new Float32Array(numG * 16);


  let matIdentity : number[] = [1, 0, 0, 0,/*Col 1*/ 0, 1, 0, 0,/*Col 2*/ 0, 0, 1, 0/*Col 3*/];
  let volumeP = h * h * h / 8.0;
  for (let i = 0; i < numP; i++) {
    // Fill in p1Data
    let matType = Math.floor(Math.random() * 3);
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

    p1Data[8 * i + 0] = 2 * (Math.random() - 0.5);  // Particle Position X Component (1 float)
    p1Data[8 * i + 1] = 2 * (Math.random() - 0.5);  // Particle Position Y Component (1 float)
    p1Data[8 * i + 2] = 2 * (Math.random() - 0.5);  // Particle Position Z Component (1 float)
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


  // It calls device.createBuffer() which takes the size of the buffer and its usage. 
  // It results in a GPU buffer object mapped at creation thanks to mappedAtCreation 
  // set to true.
  const p1Buffer = device.createBuffer({
    size: p1Data.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  // The associated raw binary data buffer can be retrieved 
  // by calling the GPU buffer method getMappedRange().
  new Float32Array(p1Buffer.getMappedRange()).set(p1Data); // Write bytes to buffer
  // At this point, the GPU buffer is mapped, meaning it is owned by the CPU, and 
  // it’s accessible in read/write from JavaScript. In order for the GPU to access it, 
  // it has to be unmapped which is as simple as calling gpuBuffer.unmap().
  //    (The concept of mapped/unmapped is needed to prevent race conditions where 
  //    GPU and CPU access memory at the same time.)
  p1Buffer.unmap();


  const p2Buffer = device.createBuffer({
    size: p2Data.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(p2Buffer.getMappedRange()).set(p2Data);
  p2Buffer.unmap();


  const gBuffer = device.createBuffer({
    size: gData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(gBuffer.getMappedRange()).set(gData);
  gBuffer.unmap();


 
  // Concepts of bind group layout and bind group are specific to WebGPU. 
  // A bind group layout defines the input/output interface expected by a shader, 
  // while a bind group represents the actual input/output data for a shader.
  const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [{
      binding: 0,
      resource: {
        buffer: simParamBuffer,
        offset: 0,
        size: simParamData.byteLength
      },
    }, 
    {
      binding: 1,
      resource: {
        buffer: p1Buffer,
        offset: 0,
        size: p1Data.byteLength,
      },
    }, 
    {
      binding: 2,
      resource: {
        buffer: p2Buffer,
        offset: 0,
        size: p2Data.byteLength,
      },
    },
    {
      binding: 3,
      resource: {
        buffer: gBuffer,
        offset: 0,
        size: gData.byteLength,
      },
    }
    ],
  });



  const aspect = Math.abs(canvas.width / canvas.height);
  let projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0); // setting up projection matrix

  function getTransformationMatrix(view) {

    let modelViewProjectionMatrix = mat4.create();
    mat4.multiply(modelViewProjectionMatrix, projectionMatrix, view);

    return modelViewProjectionMatrix as Float32Array;
  }



  let t = 0;
  return function frame(timestamp, view) {
    const transformationMatrix = getTransformationMatrix(view); // gets a transformation matrix (modelViewProjection)
  
    // bind transformation matrix?
    device.defaultQueue.writeBuffer(
      uniformBuffer,
      0,
      transformationMatrix.buffer,
      transformationMatrix.byteOffset,
      transformationMatrix.byteLength
    );

    renderPassDescriptor.colorAttachments[0].attachment = swapChain.getCurrentTexture().createView();

    // Because the GPU is an independent coprocessor, all GPU commands are executed asynchronously. 
    // This is why there is a list of GPU commands built up and sent in batches when needed. In WebGPU, 
    // the GPU command encoder returned by device.createCommandEncoder()is the JavaScript object that 
    // builds a batch of “buffered” commands that will be sent to the GPU at some point.
    const commandEncoder = device.createCommandEncoder();
    {
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(computePipeline);
      passEncoder.setBindGroup(0, bindGroup);
      let GPUGridDimX = 20000; // NOT THE MPM GRID
      let GPUGridDimY = 1; // NOT THE MPM GRID
      let GPUGridDimZ = 1; // NOT THE MPM GRID
      passEncoder.dispatch(GPUGridDimX, GPUGridDimY, GPUGridDimZ);
      passEncoder.endPass();
    }
  /* -------------Example For Adding "Kernel"/Compute Shader (Part 2)------------------- */    
    {
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(g2pPipeline);
      passEncoder.setBindGroup(0, bindGroup);
      let GPUGridDimX = 20000; // NOT THE MPM GRID
      let GPUGridDimY = 1; // NOT THE MPM GRID
      let GPUGridDimZ = 1; // NOT THE MPM GRID
      passEncoder.dispatch(GPUGridDimX, GPUGridDimY, GPUGridDimZ);
      passEncoder.endPass();
    }
  /* ----------------------------------------------------------------------------------- */     

    {
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(renderPipeline);
      passEncoder.setBindGroup(0, uniformBindGroup);
      passEncoder.setVertexBuffer(0, p1Buffer);
      passEncoder.draw(1, numP, 0, 0);
      passEncoder.endPass();
    }
    // Finishing encoding commands by calling commandEncoder.finish() and submit 
    // those to the GPU device command queue. The queue is responsible for handling 
    // submissions done via device.defaultQueue.submit() with the GPU commands as arguments. 
    // This will atomically execute all the commands stored in the array in order.
    device.defaultQueue.submit([commandEncoder.finish()]);

    ++t;
  }
}

export const glslShaders = {
  vertex: `#version 450

layout(set = 0, binding = 0) uniform Uniforms {
  mat4 modelViewProjectionMatrix;
} uniforms;
  
layout(location = 0) in vec4 a_particlePos;
layout(location = 1) in vec4 a_particleVel;
layout(location = 0) out vec3 fs_pos;
void main() {
  gl_Position = uniforms.modelViewProjectionMatrix * vec4(vec3(a_particlePos), 1.0);
  fs_pos = a_particlePos.xyz;
}`,

  fragment: `#version 450
layout(location = 0) in vec3 fs_pos;
layout(location = 0) out vec4 fragColor;
void main() {
  // fragColor = vec4((normalize(fs_pos) + vec3(1.0)) / 2.0, 1.0);
  fragColor = vec4(1,1,1,0);
}`,

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


void main() {
  uint index = gl_GlobalInvocationID.x;
  if (index >= ${numPArg}) { return; }
  
  vec3 dY = gridNodes.data[30].v * 0.1;
  float dY2 = gridNodes.data[30].m * 0.1;
  vec3 dY3 = particles2.data[index].C[2] * 0.01;
  vec3 testF = particles2.data[index].F[0] * 0.00001;
  // particles1.data[index].pos += vec4(0, 0, 0, 0);
}`,

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

  // vec3 dY = gridNodes.data[30].v * 0.1;
  // float dY2 = gridNodes.data[30].m * 0.1;
  // vec3 dY3 = particles2.data[index].C[2] * 0.01;


  // -----------------------------------------
  // loop through the nearby 3*3*3 grids and gather the information to the particles

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
  
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
        for (int k = 0; k < 3; k++) {
            int nodeI = baseNodeI + i;
            int nodeJ = baseNodeJ + j;
            int nodeK = baseNodeK + k;

            int nodeID = coordinateToId(ivec3(nodeI, nodeJ, nodeK));
            float weightIJK = wI[i] * wJ[j] * wK[k];
            
            vP_PIC += gridNodes.data[nodeID].vN * weightIJK;

            // ignore APIC at the moment
            vec3 posG = vec3(float(nodeI), float(nodeJ), float(nodeK)) * params.h + minCorner;
            vec3 a = gridNodes.data[nodeID].vN;
            vec3 b = posG - particles1.data[index].pos.xyz;
            mat3 ab = mat3(vec3(a.x*b.x, a.y*b.x, a.z*b.x), vec3(a.x*b.y, a.y*b.y, a.z*b.y), vec3(a.x*b.z, a.y*b.z, a.z*b.z));
            CMat += (weightIJK * 4.0 / (params.h * params.h)) * ab;
        }
    }
  }
  
  // ignore apic for now
  particles1.data[index].v.xyz = vP_PIC.xyz;
  particles2.data[index].C = CMat;
  particles1.data[index].pos.xyz += params.dt * vP_PIC.xyz;
   

  vec3 testF = particles2.data[index].F[0] * 0.0;
  particles1.data[index].pos += vec4(testF, 0);


}`,
// --------------------------------------------------------------------------------

};