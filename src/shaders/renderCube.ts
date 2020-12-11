export const renderCubeShaders = {
    vertex: `#version 450
  layout(set = 0, binding = 0) uniform Uniforms {
    mat4 matrices[3];
  } uniforms;
  
  layout(location = 0) in vec4 position;
  layout(location = 1) in vec4 normal;
  
  layout(location = 0) out vec4 fragLightVec;
  layout(location = 1) out vec4 fragNorm;
  
  void main() {
    mat4 view = uniforms.matrices[0];
    mat4 invView = uniforms.matrices[1];
    mat4 proj = uniforms.matrices[2];
    mat4 scale = mat4(vec4(0.92, 0, 0, 0), vec4(0, 0.92, 0, 0), vec4(0, 0, 0.92, 0), vec4(0, 0, 0, 1));
    
    gl_Position = proj * view * scale * position;
    fragLightVec = invView * vec4(0,0,0,1) - position;
    fragNorm = normal;
  }
  `,
  
    fragment: `#version 450
  layout(location = 0) in vec4 fragLightVec;
  layout(location = 1) in vec4 fragNorm;
  layout(location = 0) out vec4 outColor;
  
  void main() {
    vec4 diffuseColor = vec4(0.5, 0.5, 0.7, 1);
  
    float diffuseTerm = dot(fragNorm, normalize(fragLightVec));
    diffuseTerm = clamp(diffuseTerm, 0, 1);
    float ambientTerm = 0.2;
    float lightIntensity = diffuseTerm + ambientTerm;
    outColor = diffuseColor * lightIntensity;
    outColor.a = 0.3;
  }
  `,
  };