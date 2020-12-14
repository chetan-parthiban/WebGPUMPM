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
      scale = 0.02; // 0.017 for pikachu;
    } else {
      // JELLO
      scale = 0.02; // 0.017 for pikachu;
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
  // [[2.188, 0.068, 0.788] [0.500, -1.042, 0.298] [0.500, -0.372, 0.500] [0.000, 0.000, 0.500]] red/pink - purple/pink
  // [[0.808, 0.268, -0.332] [-0.482, 0.358, -0.152] [-0.462, 0.408, -0.442] [-0.062, 0.608, 0.000]] brown - orange
  // [[0.420, 0.353, 0.327] [0.799, 0.501, 0.305] [0.154, 0.262, 0.228] [-1.176, 3.779, -2.134]] fur
  // [[0.788, 0.668, 0.000] [-0.172, 0.208, 0.000] [-0.482, 0.338, 0.000] [0.000, 0.558, 0.000]] gravy
  // [[0.810, 0.830, 0.448] [-0.330, 0.460, -1.610] [-0.352, 0.338, -0.422] [-0.042, 0.513, 0.117]] gravy2


  void main() {

    // max speed is around 5
    float t = clamp(length(fs_vel.xyz) / 2.0, 0, 1); // fluid
    float t01 = clamp(length(fs_vel.xyz), 0, 1); // jello/snow
    float t02 = clamp(length(fs_vel.xyz) / 3.0, 0, 1); // fast jello/snow
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

    // red/pink - purple/pink
    vec3 a02 = vec3(2.188, 0.068, 0.788);
    vec3 b02 = vec3(0.500, -1.042, 0.298);
    vec3 c02 = vec3(0.500, -0.372, 0.500);
    vec3 d02 = vec3(0.000, 0.000, 0.500);

    // brown - orange
    vec3 a03 = vec3(0.808, 0.268, -0.332);
    vec3 b03 = vec3(-0.482, 0.358, -0.152);
    vec3 c03 = vec3(-0.462, 0.408, -0.442);
    vec3 d03 = vec3(-0.062, 0.608, 0.000);

    // fur
    vec3 a04 = vec3(0.420, 0.353, 0.327);
    vec3 b04 = vec3(0.799, 0.501, 0.305);
    vec3 c04 = vec3(0.154, 0.262, 0.228);
    vec3 d04 = vec3(-1.176, 3.779, -2.134);

    // pink - white
    vec3 a1 = vec3(2.208, 0.770, 1.318);
    vec3 b1 = vec3(0.000, 0.738, 0.518);
    vec3 c1 = vec3(0.000, 0.130, 0.333);
    vec3 d1 = vec3(0.000, 0.718, 0.667);

    // gravy
    vec3 a22 = vec3(0.810, 0.830, 0.448);
    vec3 b22 = vec3(-0.330, 0.460, -1.610);
    vec3 c22 = vec3(-0.352, 0.338, -0.422);
    vec3 d22 = vec3(-0.042, 0.513, 0.117);

    

    
    
    if (round(fs_pos.w) == 0) {
      // JELLO
      // green - green/yellow
      if (round(fs_pos.w * 10) == 1) {
        fragColor = clamp(vec4(a01+b01*cos(2*pi*(c01*t02+d01)), 1), 0, 1);
      }

      // red/pink - purple/pink
      else if (round(fs_pos.w * 10) == 2) {
        fragColor = clamp(vec4(a02+b02*cos(2*pi*(c02*t02+d02)), 1), 0, 1);
      }

      // brown - orange
      else if (round(fs_pos.w * 10) == 3) {
        fragColor = clamp(vec4(a03+b03*cos(2*pi*(c03*t02+d03)), 1), 0, 1);
      }

      // fur
      else if (round(fs_pos.w * 10) == 4) {
        fragColor = clamp(vec4(a04+b04*cos(2*pi*(c04*t02+d04)), 1), 0, 1);
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
      // red - yellow
      if (round(fs_pos.w * 10) == 21) {
        fragColor = clamp(vec4(a0+b0*cos(2*pi*(c0*t+d0)), 1), 0, 1);
      }

      // gravy
      else if (round(fs_pos.w * 10) == 22) {
        fragColor = clamp(vec4(a22+b22*cos(2*pi*(c22*t+d22)), 1), 0, 1);
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