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

export function runRenderPipeline(encoder, descriptor, pipeline, uniforms, vertices, numInstances) {
    {
        const passEncoder = encoder.beginRenderPass(descriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, uniforms);
        passEncoder.setVertexBuffer(0, vertices);
        passEncoder.draw(1, numInstances, 0, 0);
        passEncoder.endPass();
    }
}