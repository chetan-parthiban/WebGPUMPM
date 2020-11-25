import { mat4 } from 'gl-matrix';

export function getCameraTransformFunc(canvas) {
    const aspect = Math.abs(canvas.width / canvas.height);
    let projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0); // setting up projection matrix
    
    return function(view) {
            let modelViewProjectionMatrix = mat4.create();
            mat4.multiply(modelViewProjectionMatrix, projectionMatrix, view);
            return modelViewProjectionMatrix as Float32Array;
        }
}