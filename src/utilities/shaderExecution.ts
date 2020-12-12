export function writeBuffer(device, buffer, data) {
    device.defaultQueue.writeBuffer(
        buffer,
        0,
        data.buffer,
        data.byteOffset,
        data.byteLength
      );
}

export function runComputePipeline(encoder : GPUCommandEncoder, pipeline, bindgroup, tx, ty, tz, doBenchmark : Boolean = false, benchmarkIdx : number= 0, benchmarkQuery : GPUQuerySet = undefined) {
    if (doBenchmark) {
        encoder.writeTimestamp(benchmarkQuery, benchmarkIdx);
    }
    {
        const passEncoder = encoder.beginComputePass();
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindgroup);
        passEncoder.dispatch(tx, ty, tz);
        passEncoder.endPass();
    }
    if (doBenchmark) {
        encoder.writeTimestamp(benchmarkQuery, benchmarkIdx + 1);
    }
}

export function runRenderPipeline(encoder, descriptor, renderPipeline, renderCubePipeline, uniforms, cubeUniforms, particles, cubeBuffer, numInstances, useInstance = false, instanceVertices = 1, instanceBuffer = undefined, doBenchmark : Boolean = false, benchmarkIdx : number= 0, benchmarkQuery : GPUQuerySet = undefined) 
{
    if (doBenchmark) {
        encoder.writeTimestamp(benchmarkQuery, benchmarkIdx);
    }


    {
        const passEncoder = encoder.beginRenderPass(descriptor);
        passEncoder.setPipeline(renderPipeline);
        passEncoder.setBindGroup(0, uniforms);
        passEncoder.setVertexBuffer(0, particles);
        if (useInstance) {
            passEncoder.setVertexBuffer(1, instanceBuffer);
        }
        passEncoder.draw(instanceVertices, numInstances, 0, 0);

        passEncoder.setPipeline(renderCubePipeline);
        passEncoder.setBindGroup(0, cubeUniforms);
        passEncoder.setVertexBuffer(0, cubeBuffer);
        passEncoder.draw(36, 1, 0, 0);
        
        passEncoder.endPass();
    }



    if (doBenchmark) {
        encoder.writeTimestamp(benchmarkQuery, benchmarkIdx + 1);
    }
}