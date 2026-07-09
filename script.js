import * as THREE from "https://esm.sh/three";
import { getActivePreset, resolvePresetConfig } from "./presets.js";

const preset = getActivePreset();
const config = resolvePresetConfig(preset);

const {
  POINTS_GAP,
  POINTS_X,
  POINTS_Y,
  POINT_SIZE,
  POINT_GROW,
  WAVE_HEIGHT,
  ANIMATION_SPEED,
  PARALLAX_SPEED,
  PARALLAX_AMOUNT,
  ANALYSER_SMOOTHING,
  VOICE_ATTACK,
  VOICE_RELEASE,
  VOICE_FLOW_SMOOTHING,
  SCENE_Y,
  WAVE_X,
  WAVE_Y,
  WAVE_Z,
  CAMERA_FOV,
  CAMERA_Y,
  CAMERA_Z,
  LOOK_AT_X,
  LOOK_AT_Y,
  LOOK_AT_Z,
  VIEW_OFFSET_RATIO,
  SCENE_OPACITY,
  MATERIAL_COLOR,
  VOICE_GAIN,
  WAVE_VOICE_MULTIPLIER,
  VOICE_SIZE_SHRINK,
  SPEED_VOICE_MULTIPLIER,
} = config;

const lookTarget = new THREE.Vector3(LOOK_AT_X, LOOK_AT_Y, LOOK_AT_Z);

const canvas = document.getElementById("equalizer");
const keyboard = document.querySelector(".voice-keyboard");

let camera;
let scene;
let renderer;
let particles;
let count = 0;
let voiceLift = 0;
let voiceFlow = 0;
let simulatedLevel = 0;
let useSimulation = false;

let mouseX = 0;
let mouseY = 0;
let windowHalfX = 0;
let windowHalfY = 0;

let analyser;
let frequencyData;
let audioContext;

initEqualizer();
initAudio();
bindAudioUnlock();
animate();

function bindAudioUnlock() {
  const unlock = () => {
    if (audioContext?.state === "suspended") {
      audioContext.resume();
    }
  };

  window.addEventListener("pointerdown", unlock, { once: true });
}

function initEqualizer() {
  const width = keyboard.clientWidth;
  const height = keyboard.clientHeight;

  windowHalfX = width / 2;
  windowHalfY = height / 2;

  camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 10, 10000);
  camera.position.set(0, CAMERA_Y, CAMERA_Z);

  scene = new THREE.Scene();
  scene.position.y = SCENE_Y;

  const numParticles = POINTS_X * POINTS_Y;
  const positions = new Float32Array(numParticles * 3);
  const scales = new Float32Array(numParticles);

  let i = 0;
  let j = 0;

  for (let ix = 0; ix < POINTS_X; ix++) {
    for (let iy = 0; iy < POINTS_Y; iy++) {
      positions[i] = ix * POINTS_GAP - (POINTS_X * POINTS_GAP) / 2;
      positions[i + 1] = 0;
      positions[i + 2] = iy * POINTS_GAP - (POINTS_Y * POINTS_GAP) / 2;
      scales[j] = 1;
      i += 3;
      j += 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(MATERIAL_COLOR) },
    },
    vertexShader: document.getElementById("vertexshader").textContent,
    fragmentShader: document.getElementById("fragmentshader").textContent,
  });

  particles = new THREE.Points(geometry, material);
  particles.position.set(WAVE_X, WAVE_Y, WAVE_Z);
  scene.add(particles);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  canvas.style.opacity = String(SCENE_OPACITY);

  updateCameraProjection(width, height);

  keyboard.addEventListener("pointermove", onPointerMove);
  window.addEventListener("resize", onWindowResize);
}

function updateCameraProjection(width, height) {
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const fullWidth = Math.round(width * pixelRatio);
  const fullHeight = Math.round(height * pixelRatio);
  const offsetX = Math.round(fullWidth * VIEW_OFFSET_RATIO);

  camera.aspect = width / height;
  camera.setViewOffset(fullWidth, fullHeight, offsetX, 0, fullWidth, fullHeight);
  camera.updateProjectionMatrix();
}

async function initAudio() {
  if (!navigator.mediaDevices?.getUserMedia) {
    useSimulation = true;
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
    source.connect(analyser);
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
  } catch {
    useSimulation = true;
  }
}

function readVoiceLevel() {
  if (useSimulation) {
    simulatedLevel += (Math.random() - 0.5) * 0.022;
    simulatedLevel = THREE.MathUtils.clamp(simulatedLevel, 0, 1);
    const speechPulse =
      0.17 +
      Math.max(0, Math.sin(count * 0.06)) * 0.11 +
      Math.max(0, Math.sin(count * 0.011)) * 0.16;
    return THREE.MathUtils.clamp(simulatedLevel * 0.32 + speechPulse, 0, 1);
  }

  analyser.getByteFrequencyData(frequencyData);

  let sum = 0;
  const voiceBandStart = 2;
  const voiceBandEnd = Math.floor(frequencyData.length * 0.38);

  for (let n = voiceBandStart; n < voiceBandEnd; n += 1) {
    sum += frequencyData[n];
  }

  const average = sum / (voiceBandEnd - voiceBandStart);
  return average / 255;
}

function updateVoiceEnvelope(targetLevel) {
  const target = targetLevel * VOICE_GAIN;
  const liftRate = target > voiceLift ? VOICE_ATTACK : VOICE_RELEASE;
  voiceLift += (target - voiceLift) * liftRate;
  voiceFlow += (voiceLift - voiceFlow) * VOICE_FLOW_SMOOTHING;
  return voiceFlow;
}

function onWindowResize() {
  const width = keyboard.clientWidth;
  const height = keyboard.clientHeight;

  windowHalfX = width / 2;
  windowHalfY = height / 2;

  updateCameraProjection(width, height);
  renderer.setSize(width, height, false);
}

function onPointerMove(event) {
  const rect = keyboard.getBoundingClientRect();
  mouseX = event.clientX - rect.left - windowHalfX;
  mouseY = event.clientY - rect.top - windowHalfY;
}

function animate() {
  requestAnimationFrame(animate);
  render();
}

function render() {
  const voiceAmp = updateVoiceEnvelope(readVoiceLevel());

  const targetCameraX = mouseX * PARALLAX_AMOUNT;
  const targetCameraY = CAMERA_Y + -mouseY * PARALLAX_AMOUNT;
  camera.position.x += (targetCameraX - camera.position.x) * PARALLAX_SPEED;
  camera.position.y += (targetCameraY - camera.position.y) * PARALLAX_SPEED;
  camera.lookAt(lookTarget);

  const voiceLiftAmount = Math.min(voiceAmp, 1.6);
  const waveHeight =
    WAVE_HEIGHT + voiceLiftAmount * WAVE_HEIGHT * WAVE_VOICE_MULTIPLIER;
  const voiceSizeScale = 1 - Math.min(voiceLiftAmount, 1) * VOICE_SIZE_SHRINK;
  const speedBoost = 1 + voiceLiftAmount * SPEED_VOICE_MULTIPLIER;

  const positions = particles.geometry.attributes.position.array;
  const scales = particles.geometry.attributes.scale.array;

  let i = 0;
  let j = 0;

  for (let ix = 0; ix < POINTS_X; ix++) {
    for (let iy = 0; iy < POINTS_Y; iy++) {
      positions[i + 1] =
        Math.sin((ix + count) * 0.3) * waveHeight +
        Math.sin((iy + count) * 0.5) * waveHeight;

      scales[j] =
        (POINT_SIZE +
          (Math.sin((ix + count) * 0.3) + 1) * POINT_GROW +
          (Math.sin((iy + count) * 0.5) + 1) * POINT_GROW) *
        voiceSizeScale;

      i += 3;
      j += 1;
    }
  }

  particles.geometry.attributes.position.needsUpdate = true;
  particles.geometry.attributes.scale.needsUpdate = true;

  renderer.render(scene, camera);
  count += ANIMATION_SPEED * speedBoost;
}
