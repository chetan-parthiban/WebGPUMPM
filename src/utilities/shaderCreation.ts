export function createComputePipeline(code, device, glslang) {
    return device.createComputePipeline({
        computeStage: {
          module: 
            device.createShaderModule({
                code: code,
                transform: (glsl) => glslang.compileGLSL(glsl, "compute"),
              }),
          entryPoint: "main",
        },
      });
}

export function createRenderingPipeline(shaders, device, glslang) {
  return device.createRenderPipeline({
    vertexStage: {
      module: 
        device.createShaderModule({
          code: shaders.vertex,
          transform: (glsl) => glslang.compileGLSL(glsl, "vertex"),
        }),
      entryPoint: "main",
    },
    fragmentStage: {
      module: 
      device.createShaderModule({
          code: shaders.fragment,
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
}

import { cubeVertexSize, cubeColorOffset, cubePositionOffset, cubeNormOffset } from '../utilities/cube';

export function createRenderCubePipeline (shaders, device, glslang) {
  return device.createRenderPipeline({
    vertexStage: {
      module: 
        device.createShaderModule({
          code: shaders.vertex,
          transform: (glsl) => glslang.compileGLSL(glsl, "vertex"),
        }),
      entryPoint: "main",
    },
    fragmentStage: {
      module:
        device.createShaderModule({
          code: shaders.fragment,
          transform: (glsl) => glslang.compileGLSL(glsl, "fragment"),
        }),
      entryPoint: "main",
    },

    primitiveTopology: "triangle-list",
    depthStencilState: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus-stencil8",
    },
    vertexState: {
      vertexBuffers: [
        {
          arrayStride: cubeVertexSize,
          attributes: [
            {
              // position
              shaderLocation: 0,
              offset: cubePositionOffset,
              format: "float4",
            },
            {
              // color
              shaderLocation: 1,
              offset: cubeColorOffset,
              format: "float4",
            },
            {
              // normal
              shaderLocation: 2,
              offset: cubeNormOffset,
              format: "float4",
            },
          ],
        },
      ],
    },

    rasterizationState: {
      cullMode: "none",
    },

    colorStates: [
      {
        format: "bgra8unorm",
      },
    ],
  });
}