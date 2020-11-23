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
  const h = 0.4; // Cell width of the grid
  const nxG = Math.floor((maxCorner.x - minCorner.x) / h) + 1;  // Number of grid points in the x-direction
  const nyG = Math.floor((maxCorner.y - minCorner.y) / h) + 1;  // Number of grid points in the y-direction
  const nzG = Math.floor((maxCorner.z - minCorner.z) / h) + 1;  // Number of grid points in the z-direction
  const numG = nxG * nyG * nzG; // Total number of grid points

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
  const numP = 1000;  // Total number of points

  // Test
  // let matA = new Matrix4();
  // console.log(JSON.stringify(matA)); // For debugging purposes
  // console.log(JSON.stringify(matA.elements[5])); // For debugging purposes

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
          arrayStride: 4 * 4,
          stepMode: "instance",
          attributes: [
            {
              // instance position
              shaderLocation: 0,
              offset: 0,
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
        // Deleted
        device.createShaderModule({
            code: glslShaders.compute(numP, numG),
            transform: (glsl) => glslang.compileGLSL(glsl, "compute"),
          }),
      entryPoint: "main",
    },
  });

  // const computePipeline2 = device.createComputePipeline({
  //   computeStage: {
  //     module: 
  //       // Deleted
  //       device.createShaderModule({
  //           code: glslShaders.compute2(numP),
  //           transform: (glsl) => glslang.compileGLSL(glsl, "compute"),
  //         }),
  //     entryPoint: "main",
  //   },
  // });


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




  // test: uniform projection matrix for render pipeline
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


  const volPData = new Float32Array(numP);  // An array storing the volume of each point
  const mPData = new Float32Array(numP);  // An array storing the mass of each point
  const posPData = new Float32Array(numP * 4);  // An array storing the position (xyz) and material (w) of each point
  const vPData = new Float32Array(numP * 4); // An array storing the velocity of each point
  const FPData = new Float32Array(numP * 16); // An array storing the deformation gradidnet (3x3 matrix, 4x4 here for padding purposes) of each point
  const FePData = new Float32Array(numP * 16);  // An array storing the elastic component of teh deformation gradient (3x3 matrix, 4x4 here for padding purposes) of each point (for snow)
  const FpPData = new Float32Array(numP * 16);  // An array storing the plastic component of teh deformation gradient (3x3 matrix, 4x4 here for padding purposes) of each point (for snow)
  const JPData = new Float32Array(numP);  // An array storing the J attribute of each point (for fluid use)
  const CPData = new Float32Array(numP * 16); // An array storing APIC's C matrix of each point

  const mGData = new Float32Array(numG);  // Mass stored on the grid nodes
  const vGNData = new Float32Array(numG * 4);  // New velocity stored on the grid nodes
  const vGData = new Float32Array(numG * 4);  // Old velocity stored on the grid nodes
  const forceData = new Float32Array(numG * 4);  // Force stored on the grid nodes

  let matIdentity = new Matrix4();
  let volumeP = h * h * h / 8.0;
  for (let i = 0; i < numP; i++) {
    volPData[i] = volumeP;

    let matType = Math.floor(Math.random() * 3);
    switch (matType) {
      case 0:
        mPData[i] = volumeP * rhoJello;
        break;
      case 1:
        mPData[i] = volumeP * rhoSnow;
        break;
      case 2:
        mPData[i] = volumeP * rhoFluid;
        break;  
    }

    posPData[4 * i + 0] = 2 * (Math.random() - 0.5);  // x coordinate
    posPData[4 * i + 1] = 2 * (Math.random() - 0.5);  // y coordinate
    posPData[4 * i + 2] = 2 * (Math.random() - 0.5);  // z coordinate
    posPData[4 * i + 3] = matType;  // Material Type

    vPData[4 * i + 0] = 0;
    vPData[4 * i + 1] = 0;
    vPData[4 * i + 2] = 0;
    vPData[4 * i + 3] = 0;

    for (let matrixIndex = 0; matrixIndex < 16; matrixIndex++) {
      FPData[16 * i + matrixIndex] = matIdentity.elements[matrixIndex];
      FePData[16 * i + matrixIndex] = matIdentity.elements[matrixIndex];
      FpPData[16 * i + matrixIndex] = matIdentity.elements[matrixIndex];
    }

    JPData[i] = 1.0;

    for (let matrixIndex = 0; matrixIndex < 16; matrixIndex++) {
      CPData[16 * i + matrixIndex] = 0;
    }
  }

  for (let i = 0; i < numG; i++) {
    mGData[i] = 0;

    vGNData[4 * i + 0] = 0;
    vGNData[4 * i + 1] = 0;
    vGNData[4 * i + 2] = 0;
    vGNData[4 * i + 3] = 0;

    vGData[4 * i + 0] = 0;
    vGData[4 * i + 1] = 0;
    vGData[4 * i + 2] = 0;
    vGData[4 * i + 3] = 0;

    forceData[4 * i + 0] = 0;
    forceData[4 * i + 1] = 0;
    forceData[4 * i + 2] = 0;
    forceData[4 * i + 3] = 0;
  }


  // It calls device.createBuffer() which takes the size of the buffer and its usage. 
  // It results in a GPU buffer object mapped at creation thanks to mappedAtCreation 
  // set to true.
  const volPBuffer = device.createBuffer({
    size: volPData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  // The associated raw binary data buffer can be retrieved 
  // by calling the GPU buffer method getMappedRange().
  new Float32Array(volPBuffer.getMappedRange()).set(volPData); // Write bytes to buffer
  // At this point, the GPU buffer is mapped, meaning it is owned by the CPU, and 
  // it’s accessible in read/write from JavaScript. In order for the GPU to access it, 
  // it has to be unmapped which is as simple as calling gpuBuffer.unmap().
  //    (The concept of mapped/unmapped is needed to prevent race conditions where 
  //    GPU and CPU access memory at the same time.)
  volPBuffer.unmap();


  const mPBuffer = device.createBuffer({
    size: mPData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(mPBuffer.getMappedRange()).set(mPData);
  mPBuffer.unmap();


  const posPBuffer = device.createBuffer({
    size: posPData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(posPBuffer.getMappedRange()).set(posPData);
  posPBuffer.unmap();


  const vPBuffer = device.createBuffer({
    size: vPData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(vPBuffer.getMappedRange()).set(vPData);
  vPBuffer.unmap();


  const FPBuffer = device.createBuffer({
    size: FPData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(FPBuffer.getMappedRange()).set(FPData);
  FPBuffer.unmap();  


  const FePBuffer = device.createBuffer({
    size: FePData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(FePBuffer.getMappedRange()).set(FePData);
  FePBuffer.unmap(); 


  const FpPBuffer = device.createBuffer({
    size: FpPData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(FpPBuffer.getMappedRange()).set(FpPData);
  FpPBuffer.unmap();


  const JPBuffer = device.createBuffer({
    size: JPData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(JPBuffer.getMappedRange()).set(JPData);
  JPBuffer.unmap();


  const CPBuffer = device.createBuffer({
    size: CPData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(CPBuffer.getMappedRange()).set(CPData);
  CPBuffer.unmap();


  const mGBuffer = device.createBuffer({
    size: mGData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(mGBuffer.getMappedRange()).set(mGData);
  mGBuffer.unmap();


  const vGNBuffer = device.createBuffer({
    size: vGNData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(vGNBuffer.getMappedRange()).set(vGNData);
  vGNBuffer.unmap();


  const vGBuffer = device.createBuffer({
    size: vGData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(vGBuffer.getMappedRange()).set(vGData);
  vGBuffer.unmap();


  const forceBuffer = device.createBuffer({
    size: forceData.byteLength,
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  new Float32Array(forceBuffer.getMappedRange()).set(forceData);
  forceBuffer.unmap();


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
        buffer: volPBuffer,
        offset: 0,
        size: volPData.byteLength,
      },
    }, 
    {
      binding: 2,
      resource: {
        buffer: mPBuffer,
        offset: 0,
        size: mPData.byteLength,
      },
    },
    {
      binding: 3,
      resource: {
        buffer: posPBuffer,
        offset: 0,
        size: posPData.byteLength,
      },
    }
    // ,
    // {
    //   binding: 4,
    //   resource: {
    //     buffer: vPBuffer,
    //     offset: 0,
    //     size: vPData.byteLength,
    //   },
    // },
    // {
    //   binding: 5,
    //   resource: {
    //     buffer: FPBuffer,
    //     offset: 0,
    //     size: FPData.byteLength,
    //   },
    // },
    // {
    //   binding: 6,
    //   resource: {
    //     buffer: FePBuffer,
    //     offset: 0,
    //     size: FePData.byteLength,
    //   },
    // },
    // {
    //   binding: 7,
    //   resource: {
    //     buffer: FpPBuffer,
    //     offset: 0,
    //     size: FpPData.byteLength,
    //   },
    // },
    // {
    //   binding: 8,
    //   resource: {
    //     buffer: JPBuffer,
    //     offset: 0,
    //     size: JPData.byteLength,
    //   },
    // },
    // {
    //   binding: 9,
    //   resource: {
    //     buffer: CPBuffer,
    //     offset: 0,
    //     size: CPData.byteLength,
    //   },
    // },
    // {
    //   binding: 10,
    //   resource: {
    //     buffer: mGBuffer,
    //     offset: 0,
    //     size: mGData.byteLength,
    //   },
    // },
    // {
    //   binding: 11,
    //   resource: {
    //     buffer: vGNBuffer,
    //     offset: 0,
    //     size: vGNData.byteLength,
    //   },
    // },
    // {
    //   binding: 12,
    //   resource: {
    //     buffer: vGBuffer,
    //     offset: 0,
    //     size: vGData.byteLength,
    //   },
    // },
    // {
    //   binding: 13,
    //   resource: {
    //     buffer: forceBuffer,
    //     offset: 0,
    //     size: forceData.byteLength,
    //   },
    // }
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
    // {
    //   // const passEncoder = commandEncoder.beginComputePass();
    //   // passEncoder.setPipeline(computePipeline2);
    //   // passEncoder.setBindGroup(0, bindGroup);
    //   // passEncoder.dispatch(numP, numG);
    //   // passEncoder.endPass();
    // }
    {
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(renderPipeline);
      passEncoder.setBindGroup(0, uniformBindGroup);
      passEncoder.setVertexBuffer(0, posPBuffer);
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
layout(location = 0) out vec3 fs_pos;
void main() {
  gl_Position = uniforms.modelViewProjectionMatrix * vec4(vec3(a_particlePos), 1.0);
  fs_pos = a_particlePos.xyz;
}`,

  fragment: `#version 450
layout(location = 0) in vec3 fs_pos;
layout(location = 0) out vec4 fragColor;
void main() {
  fragColor = vec4((normalize(fs_pos) + vec3(1.0)) / 2.0, 1.0);
}`,

  compute: (numPArg: number, numGArg: number) => `#version 450
// struct Particle {
//   vec4 pos;
//   vec4 vel;
// };

layout(std140, set = 0, binding = 0) uniform SimParams {
  float dt; // Timestep
  // vec3 gravity;  // Gravity
  // vec3 minCorner; // Min corner of the grid (also works as the origin of the grid for offsetting purposes)
  // vec3 maxCorner;  // Max corner of the grid
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

layout(std430, set = 0, binding = 1) buffer VOLPVEC {
  float data[${numPArg}];
} volPVec;

layout(std430, set = 0, binding = 2) buffer MPVEC {
  float data[${numPArg}];
} mPVec;

layout(std430, set = 0, binding = 3) buffer POSPVEC {
  vec4 data[${numPArg}];
} posPVec;

// layout(std430, set = 0, binding = 4) buffer VPVEC {
//   vec4 data[${numPArg}];
// } vPVec;

// layout(std430, set = 0, binding = 5) buffer FPVEC {
//   mat4 data[${numPArg}];
// } FPVec;

// layout(std430, set = 0, binding = 6) buffer FEPVEC {
//   mat4 data[${numPArg}];
// } FePVec;

// layout(std430, set = 0, binding = 7) buffer FPPVEC {
//   mat4 data[${numPArg}];
// } FpPVec;

// layout(std140, set = 0, binding = 8) buffer JPVEC {
//   float data[${numPArg}];
// } JPVec;

// layout(std140, set = 0, binding = 9) buffer CPVEC {
//   mat4 data[${numPArg}];
// } CPVec;

// layout(std140, set = 0, binding = 10) buffer MGVEC {
//   float data[${numGArg}];
// } mGVec;

// layout(std140, set = 0, binding = 11) buffer VGNVEC {
//   vec4 data[${numGArg}];
// } vGNVec;

// layout(std140, set = 0, binding = 12) buffer VGVEC {
//   vec4 data[${numGArg}];
// } vGVec;

// layout(std140, set = 0, binding = 13) buffer FORCEVEC {
//   vec4 data[${numGArg}];
// } forceVec;

void main() {
  uint index = gl_GlobalInvocationID.x;
  if (index >= ${numPArg}) { return; }

  // particlesB.particles[index].pos = vec4(vPos,1);

  // // Write back
  // particlesB.particles[index].vel = vec4(vVel,1);
}`,
// compute2: (numPArg: number, numGArg: number) => `#version 450
// struct Particle {
//   vec4 pos;
//   vec4 vel;
// };

// layout(std140, set = 0, binding = 0) uniform SimParams {
//   float deltaT;
//   float rule1Distance;
//   float rule2Distance;
//   float rule3Distance;
//   float rule1Scale;
//   float rule2Scale;
//   float rule3Scale;
// } params;

// layout(std140, set = 0, binding = 1) buffer ParticlesA {
//   Particle particles[${numPArg}];
// } particlesA;

// layout(std140, set = 0, binding = 2) buffer ParticlesB {
//   Particle particles[${numPArg}];
// } particlesB;

// void main() {
//   // https://github.com/austinEng/Project6-Vulkan-Flocking/blob/master/data/shaders/computeparticles/particle.comp

//   uint index = gl_GlobalInvocationID.x;
//   if (index >= ${numPArg}) { return; }

//   vec3 vPos = particlesB.particles[index].pos.xyz;
//   vec3 vVel = particlesB.particles[index].vel.xyz;

//   // Wrap around boundary
//   if (vPos.x < -1.0) vPos.x = 1.0;
//   if (vPos.x > 1.0) vPos.x = -1.0;
//   if (vPos.y < -1.0) vPos.y = 1.0;
//   if (vPos.y > 1.0) vPos.y = -1.0;
//   if (vPos.z < -1.0) vPos.z = 1.0;
//   if (vPos.z > 1.0) vPos.z = -1.0;

//   particlesB.particles[index].pos = vec4(vPos,1);

//   // Write back
//   particlesB.particles[index].vel = vec4(vVel,1);
// }`,
};