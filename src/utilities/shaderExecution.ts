export function writeBuffer(device, buffer, data) {
    device.defaultQueue.writeBuffer(
        buffer,
        0,
        data.buffer,
        data.byteOffset,
        data.byteLength
      );
}

export function runComputePipeline(encoder, pipeline, bindgroup, tx, ty, tz) {
    {
        const passEncoder = encoder.beginComputePass();
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindgroup);
        passEncoder.dispatch(tx, ty, tz);
        passEncoder.endPass();
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