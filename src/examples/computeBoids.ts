import { debug } from 'webpack';
import glslangModule from '../glslang';
import { mat4, vec3, vec4} from 'gl-matrix';

export const title = 'Compute Boids';
export const description = 'A GPU compute particle simulation that mimics \
                            the flocking behavior of birds. A compute shader updates \
                            two ping-pong buffers which store particle data. The data \
                            is used to draw instanced particles.';

export async function init(canvas: HTMLCanvasElement, useWGSL: boolean) {
  const numParticles = 2000;

  const adapter = await navigator.gpu.requestAdapter();
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
        // Deleted
        device.createShaderModule({
            code: glslShaders.compute(numParticles),
            transform: (glsl) => glslang.compileGLSL(glsl, "compute"),
          }),
      entryPoint: "main",
    },
  });

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
    0.04,  // deltaT;
    0.1,   // rule1Distance;
    0.025, // rule2Distance;
    0.025, // rule3Distance;
    0.02,  // rule1Scale;
    0.05,  // rule2Scale;
    0.005  // rule3Scale;
  ]);
  const simParamBuffer = device.createBuffer({
    size: simParamData.byteLength,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });
  new Float32Array(simParamBuffer.getMappedRange()).set(simParamData);
  simParamBuffer.unmap();

  const initialParticleData = new Float32Array(numParticles * 8);
  for (let i = 0; i < numParticles; ++i) {
    initialParticleData[8 * i + 0] = 2 * (Math.random() - 0.5);
    initialParticleData[8 * i + 1] = 2 * (Math.random() - 0.5);
    initialParticleData[8 * i + 2] = 2 * (Math.random() - 0.5); // Added
    initialParticleData[8 * i + 3] = 1; // Added
    initialParticleData[8 * i + 4] = 2 * (Math.random() - 0.5) * 0.1;
    initialParticleData[8 * i + 5] = 2 * (Math.random() - 0.5) * 0.1;
    initialParticleData[8 * i + 6] = 2 * (Math.random() - 0.5) * 0.1; // Added
    initialParticleData[8 * i + 7] = 1; // Added
  }

  const particleBuffers: GPUBuffer[] = new Array(2);
  const particleBindGroups: GPUBindGroup[] = new Array(2);
  for (let i = 0; i < 2; ++i) {
    particleBuffers[i] = device.createBuffer({
      size: initialParticleData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    new Float32Array(particleBuffers[i].getMappedRange()).set(initialParticleData);
    particleBuffers[i].unmap();
  }

  for (let i = 0; i < 2; ++i) {
    particleBindGroups[i] = device.createBindGroup({
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
          buffer: particleBuffers[i],
          offset: 0,
          size: initialParticleData.byteLength,
        },
      }, 
      {
        binding: 2,
        resource: {
          buffer: particleBuffers[(i + 1) % 2],
          offset: 0,
          size: initialParticleData.byteLength,
        },
      }],
    });
  }



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

    const commandEncoder = device.createCommandEncoder();
    {
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(computePipeline);
      passEncoder.setBindGroup(0, particleBindGroups[t % 2]);
      passEncoder.dispatch(numParticles);
      passEncoder.endPass();
    }
    {
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(renderPipeline);
      passEncoder.setBindGroup(0, uniformBindGroup);
      passEncoder.setVertexBuffer(0, particleBuffers[(t + 1) % 2]);
      passEncoder.draw(3, numParticles, 0, 0);
      passEncoder.endPass();
    }
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
  gl_Position = uniforms.modelViewProjectionMatrix * a_particlePos;
  fs_pos = a_particleVel.xyz;
}`,

  fragment: `#version 450
layout(location = 0) in vec3 fs_pos;
layout(location = 0) out vec4 fragColor;
void main() {
  // fragColor = vec4( (fs_pos + 1) / 2 + 0.3, 1.0);
  fragColor = vec4(normalize(fs_pos), 1.0);
}`,

  compute: (numParticles: number) => `#version 450
struct Particle {
  vec4 pos;
  vec4 vel;
};

layout(std140, set = 0, binding = 0) uniform SimParams {
  float deltaT;
  float rule1Distance;
  float rule2Distance;
  float rule3Distance;
  float rule1Scale;
  float rule2Scale;
  float rule3Scale;
} params;

layout(std140, set = 0, binding = 1) buffer ParticlesA {
  Particle particles[${numParticles} /* numParticles */];
} particlesA;

layout(std140, set = 0, binding = 2) buffer ParticlesB {
  Particle particles[${numParticles} /* numParticles */];
} particlesB;

void main() {
  // https://github.com/austinEng/Project6-Vulkan-Flocking/blob/master/data/shaders/computeparticles/particle.comp

  uint index = gl_GlobalInvocationID.x;
  if (index >= ${numParticles} /* numParticles */) { return; }

  vec3 vPos = particlesA.particles[index].pos.xyz;
  vec3 vVel = particlesA.particles[index].vel.xyz;

  vec3 cMass = vec3(0.0, 0.0, 0.0);
  vec3 cVel = vec3(0.0, 0.0, 0.0);
  vec3 colVel = vec3(0.0, 0.0, 0.0);
  int cMassCount = 0;
  int cVelCount = 0;

  vec3 pos;
  vec3 vel;
  for (int i = 0; i < ${numParticles} /* numParticles */; ++i) {
    if (i == index) { continue; }
    pos = particlesA.particles[i].pos.xyz;
    vel = particlesA.particles[i].vel.xyz;

    if (distance(pos, vPos) < params.rule1Distance) {
      cMass += pos;
      cMassCount++;
    }
    if (distance(pos, vPos) < params.rule2Distance) {
      colVel -= (pos - vPos);
    }
    if (distance(pos, vPos) < params.rule3Distance) {
      cVel += vel;
      cVelCount++;
    }
  }
  if (cMassCount > 0) {
    cMass = cMass / cMassCount - vPos;
  }
  if (cVelCount > 0) {
    cVel = cVel / cVelCount;
  }

  vVel += cMass * params.rule1Scale + colVel * params.rule2Scale + cVel * params.rule3Scale;

  // clamp velocity for a more pleasing simulation.
  vVel = normalize(vVel) * clamp(length(vVel), 0.0, 0.1);

  // kinematic update
  vPos += vVel * params.deltaT;

  // Wrap around boundary
  if (vPos.x < -1.0) vPos.x = 1.0;
  if (vPos.x > 1.0) vPos.x = -1.0;
  if (vPos.y < -1.0) vPos.y = 1.0;
  if (vPos.y > 1.0) vPos.y = -1.0;
  if (vPos.z < -1.0) vPos.z = 1.0;
  if (vPos.z > 1.0) vPos.z = -1.0;

  particlesB.particles[index].pos = vec4(vPos,1);

  // Write back
  particlesB.particles[index].vel = vec4(vVel,1);
}`,
};

