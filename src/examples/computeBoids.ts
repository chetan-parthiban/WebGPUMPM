import glslangModule from '../glslang';
import { mat4 } from 'gl-matrix';
import { exampleShaders } from '../shaders/shaders';
import { p2gShader } from '../shaders/p2g';
import { renderingShaders } from '../shaders/rendering';
import { addMaterialForceShader } from '../shaders/addMaterialForce';
import { addGravityShader } from '../shaders/addGravity';
import { clearGridDataShader } from '../shaders/clearGridData';
import { setBoundaryVelocitiesShader } from '../shaders/setBoundaryVelocities';
import { updateGridVelocityShader } from '../shaders/updateGridVelocity';
import { createRenderingPipeline, createComputePipeline } from '../utilities/shaderCreation';
import { createBuffer, createEmptyUniformBuffer } from '../utilities/bufferCreation';
import { createBindGroup } from '../utilities/bindGroupCreation';
import { getCameraTransformFunc } from '../utilities/cameraUtils'
import { simParamData, p1Data, p2Data, gData, numP, numG, nxG, nyG, nzG } from '../utilities/simulationParameters';
import * as boilerplate from '../utilities/webgpuBoilerplate';
import { runComputePipeline, runRenderPipeline, writeBuffer } from '../utilities/shaderExecution';

export const title = 'Material Point Method';
export const description = 'A hybrid Eulerian/Lagrangian method for the simulation \
                            of realistic materials, running in real time on the GPU. \
                            You can interact with the simulation by moving the camera \
                            using the WASD keys on the keyboard.';

export async function init(canvas: HTMLCanvasElement, useWGSL: boolean) {
  // setup webgpu device, context, and glsl compiler
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const glslang = await glslangModule();
  const context = canvas.getContext('gpupresent');
   
  // other boilerplate operations
  const swapChain = boilerplate.getSwapChain(device, context);
  const depthTexture = boilerplate.getDepthTexture(device, canvas);
  const renderPassDescriptor = boilerplate.getRenderPassDescriptor(depthTexture);

  // create and compile pipelines for rendering and computation
  const renderPipeline = createRenderingPipeline(renderingShaders, device, glslang);
  const computePipeline = createComputePipeline(exampleShaders.compute(numP, numG), device, glslang);
  const addMaterialForcePipeline = createComputePipeline(addMaterialForceShader.addMaterialForce(numP, numG), device, glslang);
  const addGravityPipeline = createComputePipeline(addGravityShader.addGravity(numP, numG), device, glslang);
  const clearGridDataPipeline = createComputePipeline(clearGridDataShader.clearGridData(numP, numG), device, glslang);
  const setBoundaryVelocitiesPipeline = createComputePipeline(setBoundaryVelocitiesShader.setBoundaryVelocities(numP, numG), device, glslang);
  const updateGridVelocityPipeline = createComputePipeline(updateGridVelocityShader.updateGridVelocity(numP, numG), device, glslang);
  const p2gPipeline = createComputePipeline(p2gShader.p2g(numP, numG), device, glslang);


  // create GPU Buffers
  const simParamBuffer = createBuffer(simParamData, GPUBufferUsage.UNIFORM, device);  
  const p1Buffer = createBuffer(p1Data, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE, device);  
  const p2Buffer = createBuffer(p2Data, GPUBufferUsage.STORAGE, device); 
  const gBuffer = createBuffer(gData, GPUBufferUsage.STORAGE, device); 
  const uniformBuffer = createEmptyUniformBuffer(4 * 16, device); // 4x4 matrix projection matrix for render pipeline

  // create GPU Bind Groups
  const uniformBindGroup = createBindGroup([uniformBuffer], renderPipeline, device);
  const bindGroup = createBindGroup([simParamBuffer, p1Buffer, p2Buffer, gBuffer], computePipeline, device)

  // setup Camera Transformations
  let getTransformationMatrix = getCameraTransformFunc(canvas);

  let t = 0;
  return function frame(timestamp, view) {

    // prepare for the render pass
    const transformationMatrix = getTransformationMatrix(view); // gets a transformation matrix (modelViewProjection)
    writeBuffer(device, uniformBuffer, transformationMatrix);
    renderPassDescriptor.colorAttachments[0].attachment = swapChain.getCurrentTexture().createView();
    
    // record and execute command sequence on the gpu
    const commandEncoder = device.createCommandEncoder();
    runComputePipeline(commandEncoder, computePipeline, bindGroup, numP, 1, 1);
    runComputePipeline(commandEncoder, clearGridDataPipeline, bindGroup, nxG, nyG, nzG);
    runComputePipeline(commandEncoder, p2gPipeline, bindGroup, nxG, nyG, nzG);
    runComputePipeline(commandEncoder, addGravityPipeline, bindGroup, nxG, nyG, nzG);
    runComputePipeline(commandEncoder, addMaterialForcePipeline, bindGroup, nxG, nyG, nzG);
    runComputePipeline(commandEncoder, updateGridVelocityPipeline, bindGroup, nxG, nyG, nzG);
    runComputePipeline(commandEncoder, setBoundaryVelocitiesPipeline, bindGroup, nxG, nyG, nzG);
    runRenderPipeline(commandEncoder, renderPassDescriptor, renderPipeline, uniformBindGroup, p1Buffer, numP);
    device.defaultQueue.submit([commandEncoder.finish()]);

    ++t;
  }
}

