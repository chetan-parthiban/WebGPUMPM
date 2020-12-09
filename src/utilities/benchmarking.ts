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

export function resolveQuery(commandEncoder, query, querySetBuffer, queryReadBuffer, length) {
    commandEncoder.resolveQuerySet(query, 0, length, querySetBuffer, 0);
    commandEncoder.copyBufferToBuffer(querySetBuffer, 0, queryReadBuffer, 0, 8*length);
}

export async function readBuffer(readBuffer) {
    await readBuffer.mapAsync(GPUMapMode.READ);
    let timesArr = new BigUint64Array(readBuffer.getMappedRange());
    readBuffer.unmap();
    return timesArr;
}