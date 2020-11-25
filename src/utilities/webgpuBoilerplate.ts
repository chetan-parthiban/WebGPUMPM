export function getSwapChain(device, context) {
    return context.configureSwapChain({
        device,
        format: "bgra8unorm"
      });
}

export function getDepthTexture(device, canvas) {
    return device.createTexture({
        size: { width: canvas.width, height: canvas.height, depth: 1 },
        format: "depth24plus-stencil8",
        usage: GPUTextureUsage.OUTPUT_ATTACHMENT
      });
    
}

export function getRenderPassDescriptor(depthTexture)  {
    const descriptor : GPURenderPassDescriptor =  {
        colorAttachments: [{
          attachment: undefined,  // Assigned later
          loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        }],
        depthStencilAttachment: {
          attachment: depthTexture.createView(),
          depthLoadValue: 1.0,
          depthStoreOp: "store",
          stencilLoadValue: 0,
          stencilStoreOp: "store",
        }
      };
    return descriptor;
}

