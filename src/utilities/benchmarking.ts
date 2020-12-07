export function createTimestampQuerySet(device, count) {
    return device.createQuerySet({
        type: "timestamp",
        count: count
      });
}

export function createQueryBuffer(length, device){
    const buffer = device.createBuffer({
        size: length,
        usage: GPUBufferUsage.STORAGE,
        mappedAtCreation: false,
    });
    return buffer;
}