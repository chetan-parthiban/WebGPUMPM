import * as examples from '../gen/exampleLoader';
import { checkWebGPUSupport } from './helpers';
import 'webgpu-shader-module-transform';
import { setShaderRegisteredCallback } from "webgpu-live-shader-module";
import { mat4, vec3, vec4 } from 'gl-matrix';

const mainContainer = document.querySelector('main');
const descriptionContainer = document.getElementById('description-container');
const canvasContainer = document.getElementById('canvas-container');
const shaderEditor = document.getElementById('shader-editor');
const fullSource = document.getElementById('full-source');

function removeClassName(el: HTMLElement, className: string) {
    el.className = (el.className || '').replace(className, '');
}

let currentCanvas = undefined;
async function loadExample(hashName: string) {
    if (!checkWebGPUSupport()) {
        mainContainer.className += " no-demo";
        return;
    }

    const name = hashName.substring(1);

    descriptionContainer.innerHTML = "";
    canvasContainer.innerHTML = "";
    shaderEditor.innerHTML = "";
    fullSource.innerHTML = "";
    currentCanvas = undefined;

    const exampleLoader = examples[name];
    if (!exampleLoader) {
        mainContainer.className += " no-demo";
        return;
    }
    removeClassName(mainContainer, 'no-demo');

    const example = await exampleLoader();

    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 900;
    canvasContainer.appendChild(canvas);

    const useWGSL =
      new URLSearchParams(window.location.search).get("wgsl") != "0";

    const titleNode = document.createElement('h1');
    titleNode.innerHTML = example.title;
    descriptionContainer.appendChild(titleNode);

    const linkNode = document.createElement('a');
    linkNode.target = "_blank";
    linkNode.href = `https://github.com/austinEng/webgpu-samples/tree/master/src/examples/${name}.ts`;
    linkNode.innerHTML = linkNode.href;
    descriptionContainer.appendChild(linkNode);

    const descriptionNode = document.createElement('p');
    descriptionNode.innerHTML = example.description;
    descriptionContainer.appendChild(descriptionNode);

    const frame = await example.init(canvas, useWGSL);
    if (!frame) return;
    currentCanvas = canvas;

    // camera
    var cameraChange = mat4.create();
    var incr = 0.2;
    var phi = 0;
    var theta = 0;

    var eye = vec4.fromValues(0, 0, 2.5, 1);
    var right = vec4.fromValues(1,0,0,1);
    var up = vec4.fromValues(0,1,0,1);
    var forward = vec4.fromValues(0,0,1,1);
    var neweye = vec4.create();
    var newr = vec4.create();
    var newu = vec4.create();
    var newf = vec4.create();

    var rotation = mat4.create();
    var rotx = mat4.create();
    var roty = mat4.create();
    var view = mat4.create();
    mat4.translate(view, view, vec3.fromValues(-1*eye[0], -1*eye[1], -1*eye[2]))

    var updateListener = function(event) {
        switch (event.keyCode) {
            case 87: // w
                theta -= 0.1;
                break;
            case 83: // s
                theta += 0.1;
                break;
            case 65: // a
                phi -= 0.1;
                break;
            case 68: // d
                phi += 0.1;
                break;
            case 88: // x
                eye[2] -= incr;
                break;
            case 90: // z
                eye[2] += incr;
                break;

        }
        
        
        mat4.fromXRotation(rotx, theta);
        mat4.fromYRotation(roty, phi);
        mat4.multiply(rotation, roty, rotx);

        
        vec4.transformMat4(newr, right, rotation);
        vec4.transformMat4(newu, up, rotation);
        vec4.transformMat4(newf, forward, rotation);
        vec4.transformMat4(neweye, eye, cameraChange); 

        view = mat4.fromValues(newr[0], newu[0], newf[0], 0, 
                              newr[1], newu[1], newf[1], 0, 
                              newr[2], newu[2], newf[2], 0, 
                              -1*neweye[0], -1*neweye[1], -1*neweye[2], 1);
        
    }; 


    async function doFrame(timestamp) {
        if (currentCanvas !== canvas) return;

        window.addEventListener('keydown', updateListener, false);
        await frame(timestamp, view);

        requestAnimationFrame(doFrame);
    }
    requestAnimationFrame(doFrame);
}

const exampleLinks = document.querySelectorAll('a.nav-link');
let lastSelected = undefined;
exampleLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (lastSelected !== undefined) {
            removeClassName(lastSelected, 'selected');
        }
        link.className += ' selected';
        lastSelected = link;
    });
});

window.addEventListener('popstate', () => {
    loadExample(window.location.hash);
});

loadExample(window.location.hash);
