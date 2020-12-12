export const renderingShaders = {
    vertex: `#version 450
  
  // layout(set = 0, binding = 0) uniform Uniforms {
  //   mat4 modelViewProjectionMatrix;
  // } uniforms;

  layout(set = 0, binding = 0) uniform Uniforms {
    mat4 matrices[3];
  } uniforms;
    
  layout(location = 0) in vec4 a_particlePos;
  layout(location = 1) in vec4 a_particleVel;
  layout(location = 2) in vec4 a_cubePos;
  layout(location = 3) in vec4 a_cubeNor;

  layout(location = 0) out vec4 fs_pos;
  layout(location = 1) out vec4 fs_vel;

  layout(location = 2) out vec4 fragLightVec;
  layout(location = 3) out vec4 fragNorm;

  void main() {
    mat4 view = uniforms.matrices[0];
    mat4 invView = uniforms.matrices[1];
    mat4 proj = uniforms.matrices[2];
    float scale;
  
    if (round(a_particlePos.w) == 2) {
      // FLUID
      scale = 0.01;
    } else if (round(a_particlePos.w)== 1){
      // SNOW
      scale = 0.02;
    } else {
      // JELLO
      scale = 0.03;
    }

    gl_Position = proj * view * vec4(a_particlePos.xyz+(a_cubePos.xyz*scale), 1.0);
    fragLightVec = invView * vec4(0,0,0,1) - vec4(a_particlePos.xyz+(a_cubePos.xyz*scale), 1.0);
    fs_pos = a_particlePos;
    fs_vel = a_particleVel;

    fragNorm = a_cubeNor;
  }`,
  
    fragment: `#version 450
  layout(location = 0) in vec4 fs_pos;
  layout(location = 1) in vec4 fs_vel;

  layout(location = 2) in vec4 fragLightVec;
  layout(location = 3) in vec4 fragNorm;

  layout(location = 0) out vec4 fragColor;

  // [[-1.670, 0.790, 0.610] [-2.862, 0.700, 2.420] [0.318, 0.410, 0.050] [0.090, 0.533, 0.737]] blue to cyan
  // [[-1.670, 0.790, 0.610] [-2.530, 0.700, 2.420] [0.318, 0.410, 0.050] [0.100, 0.553, 0.737]] blue-cyan 2
  // [[0.500, 0.500, -0.882] [0.640, 0.500, 0.000] [0.100, 0.500, 0.000] [0.000, 0.513, 0.000]] red -- yellow
  // [[2.208, 0.770, 1.318] [0.000, 0.738, 0.518] [0.000, 0.130, 0.333] [0.000 0.718 0.667]] pink-white

  // [[0.000, 0.628, -0.152] [0.738, 0.500, 0.358] [-0.302, 0.333, 0.500] [0.338, 0.667, 0.500]] green - yellow/green


  void main() {

    // max speed is around 5
    float t = clamp(length(fs_vel.xyz) / 2.0, 0, 1); // fluid
    float t01 = clamp(length(fs_vel.xyz), 0, 1); // jello/snow
    float pi = 3.1415926535;

    // fluid: blue - cyan
    vec3 a2 = vec3(-1.670, 0.790, 0.610);
    vec3 b2 = vec3(-2.530, 0.700, 2.420);
    vec3 c2 = vec3(0.318, 0.410, 0.050);
    vec3 d2 = vec3(0.100, 0.533, 0.737);
    
    // jello: red - yellow
    vec3 a0 = vec3(0.500, 0.500, -0.882);
    vec3 b0 = vec3(0.640, 0.500, 0.000);
    vec3 c0 = vec3(0.100, 0.500, 0.000);
    vec3 d0 = vec3(0.000, 0.513, 0.000);

    // green - yellow/green
    vec3 a01 = vec3(0.000, 0.628, -0.152);
    vec3 b01 = vec3(0.738, 0.500, 0.358);
    vec3 c01 = vec3(-0.302, 0.333, 0.500);
    vec3 d01 = vec3(0.338, 0.667, 0.500);

    // pink - white
    vec3 a1 = vec3(2.208, 0.770, 1.318);
    vec3 b1 = vec3(0.000, 0.738, 0.518);
    vec3 c1 = vec3(0.000, 0.130, 0.333);
    vec3 d1 = vec3(0.000, 0.718, 0.667);
    
    if (round(fs_pos.w) == 0) {
      // JELLO
      if (round(fs_pos.w * 10) == 1) {
        fragColor = clamp(vec4(a01+b01*cos(2*pi*(c01*t01+d01)), 1), 0, 1);
      }

      
      else {
        // default Jello: red - yellow
        fragColor = clamp(vec4(a0+b0*cos(2*pi*(c0*t01+d0)), 1), 0, 1);
      }
      

    } else if (round(fs_pos.w) == 1) {
      // SNOW
      if (round(fs_pos.w * 10) == 11) {
        fragColor = clamp(vec4(a1+b1*cos(2*pi*(c1*t01+d1)), 1), 0, 1);
      }
      

      else {
        // default snow
        fragColor = vec4(1,1,1,1);
      }

    
    } else if (round(fs_pos.w) == 2) {
      // FLUID
      if (round(fs_pos.w * 10) == 21) {
        fragColor = clamp(vec4(a0+b0*cos(2*pi*(c0*t+d0)), 1), 0, 1);
      }

      else {
        // default fluid: blue - cyan
        fragColor = clamp(vec4(a2+b2*cos(2*pi*(c2*t+d2)), 1), 0, 1);
      }
      

    } else {
      // SHOULD NOT GET TO THIS ELSE STATEMENT IF EVERYTHING WORKS RIGHT
      fragColor = vec4(1,0,1,1);
    }
    

    float diffuseTerm = dot(fragNorm, normalize(fragLightVec));
    diffuseTerm = clamp(diffuseTerm, 0, 1);
  
    float ambientTerm = 0.2;
    float lightIntensity = diffuseTerm + ambientTerm;
    fragColor = clamp(fragColor * lightIntensity, 0, 1);

  }`,
};