// src/engine/shaders/FogShader.js
export const FOG_FRAGMENT_SHADER = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform float uSpeed;

// 2D Random
float random (vec2 st) {
    return fract(sin(dot(st.xy, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D Noise
float noise (vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Fractal Brownian Motion for "smoky" texture
float fbm (vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    
    vec2 p = st;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.02;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 uv = vTextureCoord;
    
    // Volumetric Horizontal Band Mask with smooth edge fade-out at boundaries
    float band = smoothstep(0.12, 0.45, uv.y) * (1.0 - smoothstep(0.55, 0.88, uv.y));
    
    // Vector shift driven by wind speed and slow rising heat
    vec2 shift = vec2(uTime * uSpeed, uTime * -0.05);
    
    // Scale coordinate mapping (12x horizontally, 6x vertically) to create detailed wind-swept clouds
    vec2 noiseUV = uv * vec2(12.0, 6.0);
    
    // Compute layered dynamic noise
    float n1 = fbm(noiseUV + shift);
    float n2 = fbm(noiseUV * 2.1 - shift * 0.85) * 0.45;
    float n = n1 * 0.65 + n2 * 0.35;
    
    // Apply contrast and thresholding curves to sculpt flat haze into distinct wisps of smoke
    n = clamp(n * 1.5 - 0.25, 0.0, 1.0); // Shift dark values down
    n = pow(n, 2.2) * 1.7;               // Sharpen the cloud edges and deepen shadows
    
    float alpha = n * band * uOpacity;
    
    finalColor = vec4(uColor * alpha, alpha);
}
`;