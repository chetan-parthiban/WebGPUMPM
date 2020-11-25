export const renderingShaders = {
    vertex: `#version 450
  
  layout(set = 0, binding = 0) uniform Uniforms {
    mat4 modelViewProjectionMatrix;
  } uniforms;
    
  layout(location = 0) in vec4 a_particlePos;
  layout(location = 1) in vec4 a_particleVel;
  layout(location = 0) out vec3 fs_pos;
  void main() {
    gl_Position = uniforms.modelViewProjectionMatrix * vec4(vec3(a_particlePos), 1.0);
    fs_pos = a_particlePos.xyz;
  }`,
  
    fragment: `#version 450
  layout(location = 0) in vec3 fs_pos;
  layout(location = 0) out vec4 fragColor;
  void main() {
    fragColor = vec4((normalize(fs_pos) + vec3(1.0)) / 2.0, 1.0);
  }`,
};