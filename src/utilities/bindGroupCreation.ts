export function createBindGroup(buffers, pipeline, device) {
    let entries = buffers.map(function(buffer, idx) {
        return {
            binding: idx,
            resource: {
              buffer: buffer
            },
          };
    })
    return device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: entries,
      });
}