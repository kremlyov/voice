# Voice Keyboard — прототип голосового ввода

Прототип UI клавиатуры с голосовым вводом (по макетам Figma «Голосовые команды»).
Vanilla HTML/CSS/JS + Three.js (эквалайзер из точек).

## Live & repo

- **Live:** https://kremlyov.github.io/voice/
- **GitHub:** https://github.com/kremlyov/voice
- **Figma (активный экран):** https://www.figma.com/design/FCvbqHRWmuRDaszBCVjevb/?node-id=1146-2067
- **Figma (стартовый экран):** https://www.figma.com/design/FCvbqHRWmuRDaszBCVjevb/?node-id=1160-86391

## Запуск локально

```bash
cd voice-keyboard-app
python3 -m http.server 8080
# http://localhost:8080
```

Нужен HTTP (не `file://`) — ES modules и микрофон.

## Файлы

| Файл | Назначение |
|------|------------|
| `index.html` | Разметка: фон, toolbar, статус, текст-пример, canvas |
| `styles.css` | UI, переливающийся фон, режимы idle/listening, анимация кнопки |
| `script.js` | Three.js эквалайзер, микрофон, переключение режимов |
| `presets.js` | **Пресеты сцены** — главный якорь для отката настроек |
| `assets/` | SVG иконки, текстуры фона |

## Два режима UI

Классы на `.voice-keyboard`: `--idle` | `--listening`.

### Idle (старт)
- Кнопка справа: чёрная pill **микрофон + «Начать»** (галочки нет)
- Лого **24px по центру экрана** (не между кнопками), без текста «Говорите, я слушаю»
- Блок «Например» + пример фразы видны
- Волны — **ровная плоскость**, без реакции на голос
- Микрофон **не запрашивается** до нажатия «Начать»

### Listening (запись)
- Кнопка: **галочка** (круг), анимированный переход pill → circle
- Лого 20px + «Говорите, я слушаю» по центру экрана
- Волны живые, реагируют на голос
- Микрофон включается при входе в режим

Переключение: `#actionBtn` — «Начать» → listening, галочка → idle.
Логика: `setListening()` / `modeBlend` в `script.js`.

## Пресет «центр волны»

**Главная сохранённая точка.** Все ключевые параметры камеры, сетки, голоса, фона.

```js
// presets.js
export const ACTIVE_PRESET = "центр волны";
```

Чтобы откатиться — поменять `ACTIVE_PRESET` или править значения в `WAVE_PRESETS["центр волны"]`.

### Что зафиксировано (2026-07-10)

**Сетка:** gap 218.4 (X = Z), точки 9.105, 50×50, `WAVE_LISTENING_HEIGHT` 70  
**Камера:** Y 660, Z ratio 0.72, вид «с вертолёта» (LOOK_AT_Y_OFFSET 1.0, LOOK_AT_Z 0.52)  
**Центр кадра:** `VIEW_OFFSET_RATIO: 0.25` — через `camera.setViewOffset`, не сдвиг сцены  
**Точки:** чёрные, прозрачность слоя canvas 30% (`sceneOpacity: 0.3`)  
**Фон:** база `#F6F8FB` + CSS-градиент (`--shimmer-gradient-opacity: 0.2`)  
**Позиция слоёв (styles.css):**
- `--wave-layer-lift: 34px` — фон + shimmer (`transform`)
- `--wave-scene-lift: 6px` — только canvas волны, поверх фона
- WebGL рендер по `keyboard.clientHeight` (286px), **не** по высоте canvas с lift — иначе ломается aspect

**Голос:** attack 0.52, release 0.09, flow 0.14, gain 2.35, wave ×6.3, shrink −10%

## Важные технические решения

1. **Центр перспективы** — только `VIEW_OFFSET_RATIO`, не `scene.position.x` / не `particles.position.x` (сетка обрезается по краю).
2. **Подъём волны** — только CSS `transform` на `.voice-keyboard__bg` / `__equalizer`; не `top: -Npx` (ломает aspect canvas).
3. **Размер WebGL** — `keyboard.clientWidth/Height`, не `canvas.getBoundingClientRect()` после lift.
4. **Высота волны** — `particles.position.y = 420`, не `scene.position.y`.
5. **Прозрачность точек** — на всём `<canvas>`, не per-point alpha (иначе точки просвечивают друг через друга).
6. **Фон** — код (3 CSS-слоя + grain), текстура `assets/bg-texture.png` для «морозного стекла». Прозрачность градиента: `--shimmer-gradient-opacity` на `.voice-keyboard`.
7. **Three.js** — import из `https://esm.sh/three` (CDN, без bundler).

## Что НЕ сделано

- [ ] Speech-to-text (распознавание речи в текст) — отложено; для прототипа можно Web Speech API
- [ ] Переключение на обычную клавиатуру (кнопка слева — заглушка)
- [ ] `presets.js` → CSS vars для фона (сейчас bg opacity только в CSS)

## Для AI в новом чате

```
Продолжаем voice-keyboard-app (репо kremlyov/voice).
Прочитай README.md и presets.js — пресет «центр волны» не ломать без запроса.
Два режима: idle / listening (см. README).
```

При правках эквалайзера — сначала `presets.js`, потом `script.js`.
При правках UI/фона — `styles.css`, `index.html`.
После значимых настроек — обновлять пресет «центр волны» и note внутри него.

## Деплой на GitHub Pages

Репозиторий: `kremlyov/voice`, branch `main`, root `/`.  
После изменений — upload файлов или push → подождать 1–2 мин → hard refresh live.
