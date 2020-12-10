export const renderingShaders = {
    vertex: `#version 450
  
  layout(set = 0, binding = 0) uniform Uniforms {
    mat4 modelViewProjectionMatrix;
  } uniforms;
    
  layout(location = 0) in vec4 a_particlePos;
  layout(location = 1) in vec4 a_particleVel;
  layout(location = 2) in vec4 a_cubePos;
  layout(location = 3) in vec4 a_cubeNor;

  layout(location = 0) out vec4 fs_pos;
  layout(location = 1) out vec4 fs_vel;
  void main() {
    gl_Position = uniforms.modelViewProjectionMatrix * vec4(a_particlePos.xyz+(a_cubePos.xyz*0.01), 1.0);
    fs_pos = a_particlePos;
    fs_vel = a_particleVel;
  }`,
  
    fragment: `#version 450
  layout(location = 0) in vec4 fs_pos;
  layout(location = 1) in vec4 fs_vel;
  layout(location = 0) out vec4 fragColor;

  // [[-1.670, 0.790, 0.610] [-2.862, 0.700, 2.420] [0.318, 0.410, 0.050] [0.090, 0.533, 0.737]] blue to cyan
  // [[-1.670, 0.790, 0.610] [-2.530, 0.700, 2.420] [0.318, 0.410, 0.050] [0.100, 0.553, 0.737]] blue-cyan 2
  // [[0.500, 0.500, -0.882] [0.640, 0.500, 0.000] [0.100, 0.500, 0.000] [0.000, 0.513, 0.000]] red -- yellow
  // [[2.208, 0.770, 1.318] [0.000, 0.738, 0.518] [0.000, 0.130, 0.333] [0.000 0.718 0.667]] pink-white

  void main() {

    // max speed is around 5
    float t = clamp(length(fs_vel.xyz) / 2.0, 0, 1);
    float t01 = clamp(length(fs_vel.xyz), 0, 1);
    vec3 a2 = vec3(-1.670, 0.790, 0.610);
    vec3 b2 = vec3(-2.530, 0.700, 2.420);
    vec3 c2 = vec3(0.318, 0.410, 0.050);
    vec3 d2 = vec3(0.100, 0.533, 0.737);
    float pi = 3.1415926535;

    vec3 a0 = vec3(0.500, 0.500, -0.882);
    vec3 b0 = vec3(0.640, 0.500, 0.000);
    vec3 c0 = vec3(0.100, 0.500, 0.000);
    vec3 d0 = vec3(0.000, 0.513, 0.000);

    vec3 a1 = vec3(2.208, 0.770, 1.318);
    vec3 b1 = vec3(0.000, 0.738, 0.518);
    vec3 c1 = vec3(0.000, 0.130, 0.333);
    vec3 d1 = vec3(0.000, 0.718, 0.667);
    
    if (abs(fs_pos.w - 0) <= 0.1) {
      // JELLO
      // fragColor = vec4(1,0.47,0.06,1);
      fragColor = clamp(vec4(a0+b0*cos(2*pi*(c0*t01+d0)), 1), 0, 1);
    } else if (abs(fs_pos.w - 1) <= 0.1) {
      // SNOW
      // fragColor = clamp(vec4(a1+b1*cos(2*pi*(c1*t01+d1)), 1), 0, 1);
      fragColor = vec4(1,1,1,1);
    } else if (abs(fs_pos.w - 2) <= 0.1) {
      // FLUID
      fragColor = clamp(vec4(a2+b2*cos(2*pi*(c2*t+d2)), 1), 0, 1);
      // fragColor = vec4(0,0,1,1);
    } else {
      // SHOULD NOT GET TO THIS ELSE STATEMENT IF EVERYTHING WORKS RIGHT
      fragColor = vec4(1,1,1,1);
    }

  }`,
};