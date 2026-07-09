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
const phone = document.querySelector(".phone");
const keyboard = document.getElementById("voiceKeyboard");
const openVoiceBtn = document.getElementById("openVoiceBtn");
const backToKeyboardBtn = document.getElementById("backToKeyboardBtn");
const actionBtn = document.getElementById("actionBtn");
const transcriptEl = document.getElementById("transcript");
const transcriptResultEl = document.getElementById("transcriptResult");
const transcriptStageEl = document.getElementById("transcriptStage");

const hintEl = document.querySelector(".hint");

const DEMOS = {
  listening: {
    hint: "Например",
    phrase: "Я буду в 7 часов. Нет, в 8",
    result: "Я буду в 8 часов",
    wordDelays: [0, 440, 380, 320, 480, 1120, 360, 320],
  },
  idle: {
    hint: "Ещё пример",
    phrase: "Добавь милую эмодзи",
    result: "Я буду в 8 часов",
    emoji: "😊",
    wordDelays: [0, 440, 380],
  },
};

const DEMO_WORD_ANIM_MS = 600;
const DEMO_STEP2_PAUSE_MS = 800;
const DEMO_EMOJI_ANIM_DELAY_MS = 480;
const DEFAULT_WORD_DELAY_MS = 420;

let demoTimers = [];
let demoWordEls = [];
let demoEmojiEl = null;
let demoStep2Played = false;
let activeDemoKey = null;

let camera;
let scene;
let renderer;
let particles;
let count = 0;
let voiceLift = 0;
let voiceFlow = 0;
let modeBlend = 1;
let isListening = false;
let audioReady = false;
let simulatedLevel = 0;
let useSimulation = false;

let micStream = null;

let mouseX = 0;
let mouseY = 0;
let windowHalfX = 0;
let windowHalfY = 0;

let analyser;
let frequencyData;
let audioContext;

initEqualizer();
bindUi();
bindAudioUnlock();
animate();

function bindUi() {
  openVoiceBtn.addEventListener("click", showVoiceKeyboard);
  backToKeyboardBtn.addEventListener("click", showClassicKeyboard);

  actionBtn.addEventListener("click", () => {
    keyboard.classList.add("voice-keyboard--ui-animated");

    if (isListening) {
      setListening(false);
      return;
    }

    setListening(true, { startDemo: true });
  });
}

function showVoiceKeyboard() {
  phone.classList.remove("phone--classic");
  phone.classList.add("phone--voice");
  keyboard.classList.remove("voice-keyboard--ui-animated");
  setListening(true, { startDemo: true });
  onWindowResize();
}

function showClassicKeyboard() {
  stopDemoTranscript(false);
  resetDemoUi();
  resetVoiceUi();
  keyboard.classList.remove("voice-keyboard--ui-animated");
  phone.classList.remove("phone--voice");
  phone.classList.add("phone--classic");
}

function resetVoiceUi() {
  isListening = false;
  voiceLift = 0;
  voiceFlow = 0;
  modeBlend = 1;
  keyboard.classList.add("voice-keyboard--idle");
  keyboard.classList.remove("voice-keyboard--listening");
  actionBtn.setAttribute("aria-label", "Начать запись");
}

function setListening(active, options = {}) {
  isListening = active;
  keyboard.classList.toggle("voice-keyboard--idle", !active);
  keyboard.classList.toggle("voice-keyboard--listening", active);
  actionBtn.setAttribute("aria-label", active ? "Подтвердить" : "Начать запись");

  if (active) {
    ensureAudio();
    if (options.startDemo) {
      startDemo("listening");
    }
    return;
  }

  voiceLift = 0;
  voiceFlow = 0;
  startDemo("idle");
}

function resetDemoUi() {
  stopDemoTranscript(false);
  demoStep2Played = false;
  activeDemoKey = null;
  demoEmojiEl = null;
  transcriptEl.classList.remove("transcript--static", "transcript--dimmed");
  transcriptStageEl.classList.remove("transcript-stage--expanded");
  transcriptResultEl.replaceChildren();
  transcriptResultEl.textContent = "";
  transcriptResultEl.classList.remove("transcript--visible", "transcript--preview", "transcript--active");
  transcriptResultEl.setAttribute("aria-hidden", "true");
  demoWordEls.forEach((wordEl) => wordEl.classList.remove("transcript__word--visible"));
  transcriptEl.replaceChildren();
  demoWordEls = [];
}

function buildTranscriptWords(phrase) {
  const words = phrase.split(/\s+/);

  transcriptEl.replaceChildren(
    ...words.map((word) => {
      const span = document.createElement("span");
      span.className = "transcript__word";
      span.textContent = word;
      return span;
    }),
  );

  demoWordEls = [...transcriptEl.querySelectorAll(".transcript__word")];
}

function startDemo(demoKey) {
  if (demoKey === "idle") {
    startIdleDemo();
    return;
  }

  startListeningDemo();
}

function startListeningDemo() {
  stopDemoTranscript(false);
  demoStep2Played = false;
  activeDemoKey = "listening";
  demoEmojiEl = null;

  const { hint, phrase, wordDelays } = DEMOS.listening;
  hintEl.textContent = hint;
  buildTranscriptWords(phrase);

  transcriptEl.classList.remove("transcript--static", "transcript--dimmed");
  transcriptStageEl.classList.remove("transcript-stage--expanded");
  transcriptResultEl.replaceChildren();
  transcriptResultEl.textContent = "";
  transcriptResultEl.classList.remove("transcript--visible", "transcript--preview", "transcript--active");
  transcriptResultEl.setAttribute("aria-hidden", "true");
  demoWordEls.forEach((wordEl) => wordEl.classList.remove("transcript__word--visible"));

  scheduleWordReveal(wordDelays, "listening");
}

function startIdleDemo() {
  stopDemoTranscript(false);
  demoStep2Played = false;
  activeDemoKey = "idle";

  const { hint, phrase, result, emoji, wordDelays } = DEMOS.idle;
  hintEl.textContent = hint;
  buildTranscriptWords(phrase);

  transcriptEl.classList.remove("transcript--static", "transcript--dimmed");
  transcriptStageEl.classList.add("transcript-stage--expanded");

  const lineSpan = document.createElement("span");
  lineSpan.className = "transcript__result-line";

  const textSpan = document.createElement("span");
  textSpan.className = "transcript__result-text";
  textSpan.textContent = result;

  const emojiSpan = document.createElement("span");
  emojiSpan.className = "transcript__emoji";
  emojiSpan.textContent = emoji;

  lineSpan.append(textSpan, emojiSpan);
  transcriptResultEl.replaceChildren(lineSpan);
  demoEmojiEl = emojiSpan;

  transcriptResultEl.classList.remove("transcript--active");
  transcriptResultEl.classList.add("transcript--visible", "transcript--preview");
  transcriptResultEl.setAttribute("aria-hidden", "false");

  demoWordEls.forEach((wordEl) => wordEl.classList.remove("transcript__word--visible"));

  scheduleWordReveal(wordDelays, "idle");
}

function scheduleWordReveal(wordDelays, demoKey) {
  let elapsed = 0;

  demoWordEls.forEach((wordEl, index) => {
    elapsed += wordDelays[index] ?? DEFAULT_WORD_DELAY_MS;
    const timer = window.setTimeout(() => {
      wordEl.classList.add("transcript__word--visible");
    }, elapsed);
    demoTimers.push(timer);
  });

  const step2Timer = window.setTimeout(() => {
    if (phone.classList.contains("phone--voice") && isDemoContextActive(demoKey)) {
      playDemoStep2();
    }
  }, elapsed + DEMO_WORD_ANIM_MS + DEMO_STEP2_PAUSE_MS);
  demoTimers.push(step2Timer);
}

function isDemoContextActive(demoKey) {
  if (demoKey === "listening") {
    return isListening;
  }

  if (demoKey === "idle") {
    return !isListening;
  }

  return false;
}

function playDemoStep2() {
  if (!activeDemoKey) {
    return;
  }

  demoStep2Played = true;

  if (activeDemoKey === "idle") {
    playIdleDemoStep2();
    return;
  }

  transcriptEl.classList.add("transcript--dimmed");
  transcriptStageEl.classList.add("transcript-stage--expanded");
  transcriptResultEl.textContent = DEMOS.listening.result;
  transcriptResultEl.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    transcriptResultEl.classList.add("transcript--visible");
  });
}

function playIdleDemoStep2() {
  transcriptEl.classList.add("transcript--dimmed");
  transcriptResultEl.classList.add("transcript--active");

  const emojiTimer = window.setTimeout(() => {
    if (phone.classList.contains("phone--voice") && !isListening && demoEmojiEl) {
      demoEmojiEl.classList.add("transcript__emoji--visible");
    }
  }, DEMO_EMOJI_ANIM_DELAY_MS);
  demoTimers.push(emojiTimer);
}

function stopDemoTranscript(showStatic) {
  demoTimers.forEach((timer) => window.clearTimeout(timer));
  demoTimers = [];

  if (!showStatic) {
    return;
  }

  transcriptEl.classList.add("transcript--static");
  demoWordEls.forEach((wordEl) => wordEl.classList.add("transcript__word--visible"));

  if (demoStep2Played && activeDemoKey === "listening") {
    transcriptEl.classList.add("transcript--dimmed");
    transcriptStageEl.classList.add("transcript-stage--expanded");
    transcriptResultEl.textContent = DEMOS.listening.result;
    transcriptResultEl.classList.add("transcript--visible");
    transcriptResultEl.setAttribute("aria-hidden", "false");
    return;
  }

  if (demoStep2Played && activeDemoKey === "idle") {
    transcriptEl.classList.add("transcript--dimmed");
    transcriptStageEl.classList.add("transcript-stage--expanded");
    transcriptResultEl.classList.add("transcript--visible", "transcript--preview", "transcript--active");
    transcriptResultEl.setAttribute("aria-hidden", "false");
    demoEmojiEl?.classList.add("transcript__emoji--visible");
  }
}

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

async function ensureAudio() {
  if (audioReady) {
    if (audioContext?.state === "suspended") {
      await audioContext.resume();
    }
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    useSimulation = true;
    audioReady = true;
    return;
  }

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(micStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
    source.connect(analyser);
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    audioReady = true;
  } catch {
    useSimulation = true;
    audioReady = true;
  }
}

function readVoiceLevel() {
  if (!isListening) {
    return 0;
  }

  if (useSimulation) {
    simulatedLevel += (Math.random() - 0.5) * 0.022;
    simulatedLevel = THREE.MathUtils.clamp(simulatedLevel, 0, 1);
    const speechPulse =
      0.17 +
      Math.max(0, Math.sin(count * 0.06)) * 0.11 +
      Math.max(0, Math.sin(count * 0.011)) * 0.16;
    return THREE.MathUtils.clamp(simulatedLevel * 0.32 + speechPulse, 0, 1);
  }

  if (!analyser) {
    return 0;
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
  const targetBlend = isListening ? 0 : 1;
  modeBlend += (targetBlend - modeBlend) * 0.07;

  const voiceAmp = updateVoiceEnvelope(readVoiceLevel()) * (1 - modeBlend);

  const targetCameraX = mouseX * PARALLAX_AMOUNT * (1 - modeBlend);
  const targetCameraY = CAMERA_Y + -mouseY * PARALLAX_AMOUNT * (1 - modeBlend);
  camera.position.x += (targetCameraX - camera.position.x) * PARALLAX_SPEED;
  camera.position.y += (targetCameraY - camera.position.y) * PARALLAX_SPEED;
  camera.lookAt(lookTarget);

  const voiceLiftAmount = Math.min(voiceAmp, 1.6);
  const activeWaveHeight =
    WAVE_HEIGHT + voiceLiftAmount * WAVE_HEIGHT * WAVE_VOICE_MULTIPLIER;
  const waveHeight = activeWaveHeight * (1 - modeBlend);
  const voiceSizeScale =
    1 - Math.min(voiceLiftAmount, 1) * VOICE_SIZE_SHRINK * (1 - modeBlend);
  const speedBoost = 1 + voiceLiftAmount * SPEED_VOICE_MULTIPLIER * (1 - modeBlend);
  const motion = count * (1 - modeBlend * 0.85);
  const wavePulse = 1 - modeBlend;

  const positions = particles.geometry.attributes.position.array;
  const scales = particles.geometry.attributes.scale.array;

  let i = 0;
  let j = 0;

  for (let ix = 0; ix < POINTS_X; ix++) {
    for (let iy = 0; iy < POINTS_Y; iy++) {
      positions[i + 1] =
        Math.sin((ix + motion) * 0.3) * waveHeight +
        Math.sin((iy + motion) * 0.5) * waveHeight;

      scales[j] =
        (POINT_SIZE +
          (Math.sin((ix + motion) * 0.3) + 1) * POINT_GROW * wavePulse +
          (Math.sin((iy + motion) * 0.5) + 1) * POINT_GROW * wavePulse) *
        voiceSizeScale;

      i += 3;
      j += 1;
    }
  }

  particles.geometry.attributes.position.needsUpdate = true;
  particles.geometry.attributes.scale.needsUpdate = true;

  renderer.render(scene, camera);
  count += ANIMATION_SPEED * (0.15 + speedBoost * 0.85);
}
