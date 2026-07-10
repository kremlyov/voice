/**
 * Пресеты настроек эквалайзера.
 * Чтобы вернуться к сохранённому состоянию, установите ACTIVE_PRESET.
 */

export const WAVE_PRESETS = {
  "центр волны": {
    name: "центр волны",
    note:
      "Финал 2026-07-10. gap 218.4 (X=Z), точки 9.105, WAVE_LISTENING_HEIGHT 70, WAVE_VOICE x6.3, " +
      "слой 30%. Камера Y660 Z0.72 look 1.0/0.52, VIEW_OFFSET_RATIO 0.25. " +
      "CSS: wave-layer-lift 34px (фон), wave-scene-lift 6px (canvas), lift через transform. " +
      "WebGL: keyboard.clientWidth/Height 286px — не растягивать canvas по lift.",
    savedAt: "2026-07-10",

    grid: {
      POINTS_GAP: 218.4,
      POINTS_X: 50,
      POINTS_Y: 50,
      POINT_SIZE: 9.105,
      POINT_GROW: 9.105,
      WAVE_HEIGHT: 50,
      WAVE_LISTENING_HEIGHT: 70,
      ANIMATION_SPEED: 0.01,
    },

    scene: {
      SCENE_Y: -500,
      WAVE_X: 0,
      WAVE_Y: 420,
      WAVE_Z_RATIO: 0.25,
    },

    camera: {
      FOV: 75,
      POSITION_Z_RATIO: 0.72,
      POSITION_Y: 660,
      LOOK_AT_X: 0,
      LOOK_AT_Y_OFFSET: 1.0,
      LOOK_AT_Z_RATIO: 0.52,
    },

    view: {
      VIEW_OFFSET_RATIO: 0.25,
      sceneOpacity: 0.3,
    },

    layout: {
      waveLayerLiftPx: 34,
      waveSceneLiftPx: 6,
      renderSize: "keyboard",
      liftMethod: "transform",
    },

    background: {
      baseColor: "#f6f8fb",
      gradientOpacity: 0.2,
    },

    parallax: {
      PARALLAX_SPEED: 0.005,
      PARALLAX_AMOUNT: 0.1,
    },

    audio: {
      ANALYSER_SMOOTHING: 0.88,
      VOICE_ATTACK: 0.52,
      VOICE_RELEASE: 0.09,
      VOICE_FLOW_SMOOTHING: 0.14,
      VOICE_GAIN: 2.35,
      WAVE_VOICE_MULTIPLIER: 6.3,
      VOICE_SIZE_SHRINK: 0.1,
      SPEED_VOICE_MULTIPLIER: 0.55,
    },

    material: {
      color: 0x000000,
      pointOpacity: 1,
    },
  },
};

export const ACTIVE_PRESET = "центр волны";

export function getActivePreset() {
  const preset = WAVE_PRESETS[ACTIVE_PRESET];
  if (!preset) {
    throw new Error(`Unknown preset: ${ACTIVE_PRESET}`);
  }
  return preset;
}

export function resolvePresetConfig(preset) {
  const gapZ = preset.grid.POINTS_GAP_Z ?? preset.grid.POINTS_GAP;
  const gridDepth = preset.grid.POINTS_Y * gapZ;

  return {
    ...preset.grid,
    POINTS_GAP_Z: gapZ,
    ...preset.parallax,
    ...preset.audio,
    SCENE_Y: preset.scene.SCENE_Y,
    WAVE_X: preset.scene.WAVE_X,
    WAVE_Y: preset.scene.WAVE_Y,
    WAVE_Z: gridDepth * preset.scene.WAVE_Z_RATIO,
    CAMERA_FOV: preset.camera.FOV,
    CAMERA_Y: preset.camera.POSITION_Y ?? 0,
    CAMERA_Z: gridDepth * preset.camera.POSITION_Z_RATIO,
    LOOK_AT_X: preset.camera.LOOK_AT_X,
    LOOK_AT_Y: preset.scene.SCENE_Y + preset.scene.WAVE_Y * preset.camera.LOOK_AT_Y_OFFSET,
    LOOK_AT_Z: gridDepth * preset.camera.LOOK_AT_Z_RATIO,
    VIEW_OFFSET_RATIO: preset.view.VIEW_OFFSET_RATIO,
    VIEW_OFFSET_Y_PX: preset.view.VIEW_OFFSET_Y_PX ?? 0,
    SCENE_OPACITY: preset.view.sceneOpacity,
    MATERIAL_COLOR: preset.material.color,
    BG_BASE: preset.background?.baseColor ?? "#f6f8fb",
    BG_GRADIENT_OPACITY: preset.background?.gradientOpacity ?? 0.32,
    ANALYSER_SMOOTHING: preset.audio.ANALYSER_SMOOTHING ?? 0.9,
    VOICE_ATTACK: preset.audio.VOICE_ATTACK ?? 0.2,
    VOICE_RELEASE: preset.audio.VOICE_RELEASE ?? 0.05,
    VOICE_FLOW_SMOOTHING: preset.audio.VOICE_FLOW_SMOOTHING ?? 0.07,
    VOICE_GAIN: preset.audio.VOICE_GAIN ?? 1,
    WAVE_VOICE_MULTIPLIER: preset.audio.WAVE_VOICE_MULTIPLIER ?? 1,
    VOICE_SIZE_SHRINK: preset.audio.VOICE_SIZE_SHRINK ?? 0,
    SPEED_VOICE_MULTIPLIER: preset.audio.SPEED_VOICE_MULTIPLIER ?? 0,
  };
}
