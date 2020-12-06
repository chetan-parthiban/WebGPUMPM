export const renderingShaders = {
    vertex: `#version 450
  
  layout(set = 0, binding = 0) uniform Uniforms {
    mat4 modelViewProjectionMatrix;
  } uniforms;
    
  layout(location = 0) in vec4 a_particlePos;
  layout(location = 1) in vec4 a_particleVel;
  layout(location = 0) out vec4 fs_pos;
  layout(location = 1) out vec4 fs_vel;
  void main() {
    gl_Position = uniforms.modelViewProjectionMatrix * vec4(vec3(a_particlePos), 1.0);
    fs_pos = a_particlePos;
    fs_vel = a_particleVel;
  }`,
  
    fragment: `#version 450
  layout(location = 0) in vec4 fs_pos;
  layout(location = 1) in vec4 fs_vel;
  layout(location = 0) out vec4 fragColor;
  void main() {
    
    if (abs(fs_pos.w - 0) <= 0.1) {
      // JELLO
      fragColor = vec4(0,1,0,1);
    } else if (abs(fs_pos.w - 1) <= 0.1) {
      // SNOW
      fragColor = vec4(1,0,0,1);
    } else if (abs(fs_pos.w - 2) <= 0.1) {
      // FLUID
      fragColor = vec4(0,0,1,1);
    } else {
      // SHOULD NOT GET TO THIS ELSE STATEMENT IF EVERYTHING WORKS RIGHT
      fragColor = vec4(1,1,1,1);
    }

  }`,
};