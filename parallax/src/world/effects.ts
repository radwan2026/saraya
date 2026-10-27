// Renderer, quality presets and post-processing.
// High/medium: bloom + a grading pass that carries the temporal ripple, timeline colour grade,
// heat haze near the engine, vignette and film grain. Low: no composer; the ripple falls back to a
// CSS overlay and grading falls back to light and fog changes.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Quality } from './context';

export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uEcho: { value: 0 },
    uRipple: { value: 0 },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.014 },
    uHeat: { value: 0 },
    uHeatPos: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: 1 },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Color(0, 0, 0) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uEcho, uRipple, uVignette, uGrain, uHeat, uAspect, uFade;
    uniform vec2 uHeatPos; uniform vec3 uFadeColor; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 c = uv - 0.5; c.x *= uAspect;
      float d = length(c);
      // temporal ripple: rings expanding from the centre of view
      float front = uRipple;
      float wave = sin(d*48.0 - uTime*22.0) * uRipple * 0.010 * smoothstep(0.0, 0.5, d);
      uv += (c / max(d, 1e-4)) * wave * vec2(1.0/uAspect, 1.0);
      // heat haze around the engine
      vec2 hp = vUv - uHeatPos; hp.x *= uAspect;
      float hz = uHeat * smoothstep(0.22, 0.0, length(hp));
      uv += vec2(sin(vUv.y*90.0 + uTime*3.1), cos(vUv.x*80.0 + uTime*2.7)) * 0.0022 * hz;
      // chromatic split while time folds
      float ca = 0.004 * front + 0.0006;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c*ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c*ca).b;
      // grading: the present is cold and drained, the echo warm and full
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 present = mix(vec3(l), col, 0.72) * vec3(0.9, 1.0, 1.08) + vec3(0.0, 0.004, 0.008);
      vec3 echo = col * vec3(1.12, 1.0, 0.82) + vec3(0.012, 0.006, 0.0);
      echo = mix(echo, echo*echo*1.6, 0.12);
      col = mix(present, echo, uEcho);
      col += vec3(0.25, 0.9, 0.85) * uRipple * 0.05 * smoothstep(0.6, 0.0, abs(d - (1.0 - uRipple)*0.8));
      col *= mix(1.0, smoothstep(0.95, 0.2, d), uVignette);
      col += (hash(vUv*vec2(1920.0,1080.0) + fract(uTime)*100.0) - 0.5) * uGrain;
      col = mix(col, uFadeColor, uFade);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export interface Pipeline {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer | null;
  grade: ShaderPass | null;
  bloom: UnrealBloomPass | null;
  quality: Quality;
  resize: () => void;
  render: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void;
  dispose: () => void;
}

export function detectQuality(): Quality {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'low';
    const touch = matchMedia('(pointer: coarse)').matches;
    return touch ? 'medium' : 'high';
  } catch {
    return 'low';
  }
}

export function createPipeline(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera, quality: Quality, makeScene: (r: THREE.WebGLRenderer) => THREE.Scene): Pipeline {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'high', powerPreference: 'high-performance' });
  const dpr = quality === 'high' ? Math.min(devicePixelRatio, 2) : quality === 'medium' ? Math.min(devicePixelRatio, 1.25) : 1;
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = makeScene(renderer);

  let composer: EffectComposer | null = null;
  let grade: ShaderPass | null = null;
  let bloom: UnrealBloomPass | null = null;
  if (quality !== 'low') {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), quality === 'high' ? 0.42 : 0.36, 0.55, 0.86);
    composer.addPass(bloom);
    grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    composer.addPass(new OutputPass());
  }

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    // keep a usable horizontal field of view on portrait screens
    camera.fov = w < h ? 84 : 68;
    camera.updateProjectionMatrix();
    if (grade) grade.uniforms.uAspect.value = w / h;
  };
  resize();

  return {
    renderer,
    composer,
    grade,
    bloom,
    quality,
    resize,
    render: (s, c) => (composer ? composer.render() : renderer.render(s, c)),
    dispose: () => {
      composer?.dispose();
      renderer.dispose();
    },
  };
}
