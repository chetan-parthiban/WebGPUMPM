export const renderingShaders = {
    vertex: `#version 450
  
  layout(set = 0, binding = 0) uniform Uniforms {
    mat4 modelViewProjectionMatrix;
  } uniforms;
    
  layout(location = 0) in vec4 a_particlePos;
  layout(location = 1) in vec4 a_particleVel;
  layout(location = 0) out vec3 fs_pos;
  layout(location = 1) out vec3 fs_vel;
  void main() {
    gl_Position = uniforms.modelViewProjectionMatrix * vec4(vec3(a_particlePos), 1.0);
    fs_pos = a_particlePos.xyz;
    fs_vel = a_particleVel.xyz;
  }`,
  
    fragment: `#version 450
  layout(location = 0) in vec3 fs_pos;
  layout(location = 1) in vec3 fs_vel;
  layout(location = 0) out vec4 fragColor;

  // [[0.208, 0.668 0.808], [-0.082, 0.648, 0.498] [0.000, 0.330, 0.495] [0.028, 0.695, 0.528]] green to cyan
  // [[1.828, 1.388, 2.628] [1.028, 0.588, 0.367] [0.272, 0.272, 0.207] [2.516, 2.456, 0.146]]

  void main() {
    float t = 1 - length(clamp(fs_vel.xyz, 0, 1));
    vec3 a = vec3(1.828, 1.388, 2.628);
    vec3 b = vec3(1.028, 0.588, 0.367);
    vec3 c = vec3(0.272, 0.272, 0.207);
    vec3 d = vec3(2.516, 2.456, 0.146);
    float pi = 3.1415926535;

    // fragColor = vec4(a+b*cos(2*pi*(c*t+d)), 1);
    fragColor = vec4(0,0,0,1);
    // fragColor = vec4(fs_vel.xyz, 1);
  }`,
};