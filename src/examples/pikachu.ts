import glslangModule from '../glslang';
import { mat4 } from 'gl-matrix';
import { exampleShaders } from '../shaders/shaders';
import { p2gShader } from '../shaders/p2g';
import { renderingShaders } from '../shaders/rendering';
import { renderCubeShaders } from '../shaders/renderCube';
import { addMaterialForceShader } from '../shaders/addMaterialForce';
import { addGravityShader } from '../shaders/addGravity';
import { clearGridDataShader } from '../shaders/clearGridData';
import { setBoundaryVelocitiesShader } from '../shaders/setBoundaryVelocities';
import { updateGridVelocityShader } from '../shaders/updateGridVelocity';
import { g2pShader } from '../shaders/g2p';
import { evolveFandJShader } from '../shaders/evolveFandJ';
import { p2g_PShader } from '../shaders/p2g_P';
import { addMaterialForce_PShader } from '../shaders/addMaterialForce_P';

import { getCriteriaShader } from '../shaders/getCriteria';
import { upSweepShader } from '../shaders/upSweep';
import { setRootToZeroShader } from '../shaders/setRootToZero';
import { downSweepShader } from '../shaders/downSweep';
import { scatterShader } from '../shaders/scatter';
import { clearSCShader } from '../shaders/clearSC';

import { testShader } from '../shaders/test';

import { createRenderingPipeline, createRenderCubePipeline, createComputePipeline } from '../utilities/shaderCreation';
import { createBuffer, createEmptyUniformBuffer } from '../utilities/bufferCreation';
import { createBindGroup } from '../utilities/bindGroupCreation';
import { simParamData, p1Data, p2Data, gData, numP, numG, nxG, nyG, nzG, dt, gSCData, numGPadded, sweepIters, doBenchmark, queryLength } from '../sceneConfigs/pikachuScene';
import { getCameraTransformFunc, getProjectionMatrix } from '../utilities/cameraUtils'
import * as boilerplate from '../utilities/webgpuBoilerplate';
import { runComputePipeline, runRenderPipeline, writeBuffer } from '../utilities/shaderExecution';
import { createQueryBuffer, createReadBuffer, createTimestampQuerySet, resolveQuery } from '../utilities/benchmarking';
import * as cubeParams from '../cube';
import * as cubeParams2 from '../cube2'

export const title = 'Material Point Method';
export const description = 'A hybrid Eulerian/Lagrangian method for the simulation \
                            of realistic materials, running in real time on the GPU. \
                            You can interact with the simulation by moving the camera \
                            using the WASD keys on the keyboard.';

export async function init(canvas: HTMLCanvasElement, useWGSL: boolean) {
  // setup webgpu device, context, and glsl compiler
  const adapter = await navigator.gpu.requestAdapter({powerPreference : "high-performance"});
  const device = await adapter.requestDevice({extensions: ["timestamp-query"]});
  const glslang = await glslangModule();
  const context = canvas.getContext('gpupresent');
   
  // other boilerplate operations
  const swapChain = boilerplate.getSwapChain(device, context);
  const depthTexture = boilerplate.getDepthTexture(device, canvas);
  const renderPassDescriptor = boilerplate.getRenderPassDescriptor(depthTexture);

  // create and compile pipelines for rendering and computation
  const renderPipeline = createRenderingPipeline(renderingShaders, device, glslang);
  const computePipeline = createComputePipeline(exampleShaders.compute(numP, numG, numGPadded), device, glslang);
  const addMaterialForcePipeline = createComputePipeline(addMaterialForceShader.addMaterialForce(numP, numG, numGPadded), device, glslang);
  const addGravityPipeline = createComputePipeline(addGravityShader.addGravity(numP, numG, numGPadded), device, glslang);
  const clearGridDataPipeline = createComputePipeline(clearGridDataShader.clearGridData(numP, numG, numGPadded), device, glslang);
  const setBoundaryVelocitiesPipeline = createComputePipeline(setBoundaryVelocitiesShader.setBoundaryVelocities(numP, numG, numGPadded), device, glslang);
  const updateGridVelocityPipeline = createComputePipeline(updateGridVelocityShader.updateGridVelocity(numP, numG, numGPadded), device, glslang);
  const p2gPipeline = createComputePipeline(p2gShader.p2g(numP, numG, numGPadded), device, glslang);
  const g2pPipeline = createComputePipeline(g2pShader.g2p(numP, numG, numGPadded), device, glslang);
  const evolveFandJPipeline = createComputePipeline(evolveFandJShader.evolveFandJ(numP, numG, numGPadded), device, glslang);
  const p2g_PPipeline = createComputePipeline(p2g_PShader.p2g_P(numP, numG, numGPadded), device, glslang);
  const addMaterialForce_PPipeline = createComputePipeline(addMaterialForce_PShader.addMaterialForce_P(numP, numG, numGPadded), device, glslang);

  const getCriteriaPipeline = createComputePipeline(getCriteriaShader.getCriteria(numP, numG, numGPadded), device, glslang);
  const upSweepPipeline = createComputePipeline(upSweepShader.upSweep(numP, numG, numGPadded), device, glslang);
  const setRootToZeroPipeline = createComputePipeline(setRootToZeroShader.setRootToZero(numP, numG, numGPadded), device, glslang);
  const downSweepPipeline = createComputePipeline(downSweepShader.downSweep(numP, numG, numGPadded), device, glslang);
  const scatterPipeline = createComputePipeline(scatterShader.scatter(numP, numG, numGPadded), device, glslang);
  const clearSCPipeline = createComputePipeline(clearSCShader.clearSC(numP, numG, numGPadded), device, glslang);

  // For Testing Purposes
  const testPipeline = createComputePipeline(testShader.test(numP, numG, numGPadded), device, glslang); // For testing purposes
  
  // Render Cube Pipeline
  const renderCubePipeline = createRenderCubePipeline(renderCubeShaders, device, glslang);

  // create GPU Buffers
  const simParamBuffer = createBuffer(simParamData, GPUBufferUsage.UNIFORM, device);  
  const p1Buffer = createBuffer(p1Data, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE, device);  
  const p2Buffer = createBuffer(p2Data, GPUBufferUsage.STORAGE, device); 
  const gBuffer = createBuffer(gData, GPUBufferUsage.STORAGE, device); 
  const uniformBuffer = createEmptyUniformBuffer(4 * 16, device); // 4x4 matrix projection matrix for render pipeline
  const gSCBuffer = createBuffer(gSCData, GPUBufferUsage.STORAGE, device);
  
  const uniformBuffer2 = createEmptyUniformBuffer(3 * 4 * 16, device); // three 4x4 matrices. view, inverseView, proj.
  const uniformBufferBox = createEmptyUniformBuffer(3 * 4 * 16, device); // three 4x4 matrices. view, inverseView, proj.
  const querySetBuffer : GPUBuffer = createQueryBuffer(8*queryLength, device);
  const queryReadBuffer = createReadBuffer(8*queryLength, device);
  const query = createTimestampQuerySet(device, queryLength);
  let benchmarkArr = new Float32Array(queryLength/2);
  const cubeBuffer = createBuffer(cubeParams.cubeVertexArray, GPUBufferUsage.VERTEX, device);
  const cube2Buffer = createBuffer(cubeParams2.cubeVertexArray, GPUBufferUsage.VERTEX, device);
  // create GPU Bind Groups
  const uniformBindGroup = createBindGroup([uniformBuffer], renderPipeline, device);
  const uniformBindGroup2 = createBindGroup([uniformBuffer2], renderPipeline, device);
  const uniformBindGroupBox = createBindGroup([uniformBufferBox], renderCubePipeline, device);
  const bindGroup = createBindGroup([simParamBuffer, p1Buffer, p2Buffer, gBuffer, gSCBuffer], computePipeline, device)

  // setup Camera Transformations
  let getTransformationMatrix = getCameraTransformFunc(canvas);
  let t = 0;
  return async function frame(timestamp, view) {

    // prepare for the render pass
    // camera buffers setup
    let matricesData = new Float32Array(16 * 3);
    const projMtx = getProjectionMatrix(canvas);
    let invView = mat4.create();
    mat4.invert(invView, view);
    matricesData.set(view, 0);
    matricesData.set(invView, 16);
    matricesData.set(projMtx, 32);
    writeBuffer(device, uniformBuffer2, matricesData);
    writeBuffer(device, uniformBufferBox, matricesData);

    // prepare for the render pass
    const transformationMatrix = getTransformationMatrix(view); // gets a transformation matrix (modelViewProjection)
    writeBuffer(device, uniformBuffer, transformationMatrix);
    renderPassDescriptor.colorAttachments[0].attachment = swapChain.getCurrentTexture().createView();
    
    // record and execute command sequence on the gpu
    const commandEncoder = device.createCommandEncoder({measureExecutionTime: true});
    // // Naive Version
    // for (let i = 0; i < Math.floor(1.0 / 24.0 / dt); i++) {
    //   runComputePipeline(commandEncoder, clearGridDataPipeline, bindGroup, nxG, nyG, nzG);
    //   runComputePipeline(commandEncoder, p2gPipeline, bindGroup, nxG, nyG, nzG);
    //   runComputePipeline(commandEncoder, addGravityPipeline, bindGroup, nxG, nyG, nzG);
    //   runComputePipeline(commandEncoder, addMaterialForcePipeline, bindGroup, nxG, nyG, nzG);
    //   runComputePipeline(commandEncoder, updateGridVelocityPipeline, bindGroup, nxG, nyG, nzG);
    //   runComputePipeline(commandEncoder, setBoundaryVelocitiesPipeline, bindGroup, nxG, nyG, nzG);
    //   runComputePipeline(commandEncoder, evolveFandJPipeline, bindGroup, numP, 1, 1);
    //   runComputePipeline(commandEncoder, g2pPipeline, bindGroup, numP, 1, 1);
    // }

    // Atomics Version
    for (let i = 0; i < Math.floor(1.0 / 24.0 / dt / 20.0); i++) {
      runComputePipeline(commandEncoder, clearGridDataPipeline, bindGroup, nxG, nyG, nzG, doBenchmark, 0, query);
      runComputePipeline(commandEncoder, p2g_PPipeline, bindGroup, numP, 1, 1, doBenchmark, 2, query);
      /* ----------------------- Stream Compaction Starts -------------------------------------- */
      // Clear Stream Compaction Buffer Data
      runComputePipeline(commandEncoder, clearSCPipeline, bindGroup, numGPadded, 1, 1, doBenchmark, 4, query);
      // Get Criteria (1 if corresponding grid node has non-zero mass; 0 otherwise)
      runComputePipeline(commandEncoder, getCriteriaPipeline, bindGroup, numG, 1, 1, doBenchmark, 6, query);
      // Up-Sweep/Reduce (Exclusive Scan)
      for (let i = 0; i <= sweepIters; i++) {
        runComputePipeline(commandEncoder, upSweepPipeline, bindGroup, numGPadded, 1, 1, doBenchmark, 8, query);
      }
      // Set Root To Zero (Exclusive Scan)
      runComputePipeline(commandEncoder, setRootToZeroPipeline, bindGroup, numGPadded, 1, 1, doBenchmark, 10, query);
      // Down-Sweep (Exclusive Scan)
      for (let i = 0; i <= sweepIters; i++) {
        runComputePipeline(commandEncoder, downSweepPipeline, bindGroup, numGPadded, 1, 1, doBenchmark, 12, query);
      }
      // Scatter
      runComputePipeline(commandEncoder, scatterPipeline, bindGroup, numGPadded, 1, 1, doBenchmark, 14, query);
      /* ----------------------- Stream Compaction Ends ---------------------------------------- */
      runComputePipeline(commandEncoder, addGravityPipeline, bindGroup, numG, 1, 1, doBenchmark, 16, query);
      runComputePipeline(commandEncoder, addMaterialForce_PPipeline, bindGroup, numP, 1, 1, doBenchmark, 18, query);
      runComputePipeline(commandEncoder, updateGridVelocityPipeline, bindGroup, numG, 1, 1, doBenchmark, 20, query);
      runComputePipeline(commandEncoder, setBoundaryVelocitiesPipeline, bindGroup, nxG, nyG, nzG, doBenchmark, 22, query);
      runComputePipeline(commandEncoder, evolveFandJPipeline, bindGroup, numP, 1, 1, doBenchmark, 24, query);
      runComputePipeline(commandEncoder, g2pPipeline, bindGroup, numP, 1, 1, doBenchmark, 26, query);
    }    

    if (doBenchmark) {
      resolveQuery(commandEncoder, query, querySetBuffer, queryReadBuffer, queryLength);
    }
    runRenderPipeline(commandEncoder, renderPassDescriptor, renderPipeline, renderCubePipeline, uniformBindGroup2, 
                      uniformBindGroupBox, p1Buffer, cube2Buffer, numP, true, cubeParams.cubeVertexCount, cubeBuffer, doBenchmark, 28, query);

                      
    // Test
    // runComputePipeline(commandEncoder, clearGridDataPipeline, bindGroup, nxG, nyG, nzG);
    // runComputePipeline(commandEncoder, p2g_PPipeline, bindGroup, nxG, nyG, nzG);
    // runComputePipeline(commandEncoder, testPipeline, bindGroup, numP, 1, 1);

    
    device.defaultQueue.submit([commandEncoder.finish()]);

    if (doBenchmark) {
      await queryReadBuffer.mapAsync(GPUMapMode.READ);
      let timesArr = new BigUint64Array(queryReadBuffer.getMappedRange());
      for (let i = 0; i < queryLength/2; i++) {
        let dt = Number(timesArr[2*i + 1] - timesArr[2*i]) / 1000;
        benchmarkArr[i] = Math.round((((benchmarkArr[i]*t) +  dt)/(t+1))*100)/100;
      }
      console.log(benchmarkArr);
      queryReadBuffer.unmap();
    }
    ++t;
  }
}
