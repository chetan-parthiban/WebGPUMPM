export function createTimestampQuerySet(device, count) {
    return device.createQuerySet({
        type: "timestamp",
        count: count
      });
}

export function createQueryBuffer(length, device){
    const buffer = device.createBuffer({
        size: length,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        mappedAtCreation: false,
    });
    return buffer;
}


export function createReadBuffer(length, device){
    const buffer = device.createBuffer({
        size: length,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        mappedAtCreation: false,
    });
    return buffer;
}