# Elise-pet — Companion Transformation Design (v0.3)

## Product concept
The same gray-and-white cat alternates between two mutually exclusive states:

- **Companion mode** (`cat`): Elise in her original gray uniform, with the cat as a separate interactive character.
- **Costume mode** (`costume`): the cat is no longer an independent sprite. Instead, its identity is visually preserved by a gray-and-white cat-eared hood/hat and a gray fluffy tail on Elise.

The transformation is available from Elise's right-click menu. Left-mouse drag on Elise still moves the native window. Cat clicks remain for petting while the cat is independent.

## Implemented in first prototype
- `CompanionMode` state and menu toggle.
- In costume mode, hide independent cat and draw temporary CSS ears/hat + tail overlays.
- In companion mode, remove overlays and restore the cat.
- Stop endless up/down breathing of the whole girl.
- Preserve idle/sit/sleep pose switching, chat UI, and left-button window dragging.

**Temporary art warning:** CSS costume shapes only verify placement and behavior. They are not approved final assets. Current pose images are standalone illustrations rather than animation frames. Do not represent them as continuous walk, transformation, or lip-sync animation.

## Art requirements for polished version
All dimensions are suggested export sizes; use shared ground anchors for each action.

| Asset | Proposed path | Frames |
|---|---|---|
| Elise idle/blink | `public/assets/elise/animations/idle/` | 4–6 |
| Elise walk left/right | `public/assets/elise/animations/walk/` | 8 per direction |
| Elise sit transition | `public/assets/elise/animations/sit/` | 6–8 |
| Elise sleep transition | `public/assets/elise/animations/sleep/` | 6–8 |
| Cat walk | `public/assets/cat/animations/walk/` | 8 per direction |
| Cat curl/sleep | `public/assets/cat/animations/sleep/` | 6–8 |
| Cat transform to hat and tail | `public/assets/transform/equip/` | 10–12 |
| Hat and tail transform back to cat | `public/assets/transform/unequip/` | 10–12 |
| Cat-ear hood layers | `public/assets/costume/hood/` | PSD separated: left ear, right ear, brim, shadow |
| Cat tail layers | `public/assets/costume/tail/` | PSD separated: base, middle, tip |

Export suggested size: transparent RGBA PNG frames in 512×512 canvas for full-body character, and 256×256 for cat. Frame indexes `000.png`, `001.png`, etc. Keep subject feet/ground alignment fixed; never rescale or reposition per frame. Use original gray-white cat head markings on hood and tail for continuity.

## Animation principles
- No automatic whole-character perpetual vertical oscillation.
- Idle: stationary body, occasional blink every 3–7 seconds, subtle localized hair/tail only.
- Walk: true per-frame motion with grounded foot contacts, not alternating two different drawings.
- Equip: cat approaches Elise → small sparkle → disappears as independent cat → cat ears and tail appear.
- Unequip: reverse transition; spawn cat beside Elise.
- Menu, drag, and chat state must remain consistent during equip/unequip.
- Prefer a single explicit state machine (`cat`, `equipping`, `costume`, `unequipping`) before implementing timed frame transitions.

## QA
- Tauri Windows: check opaque white panel, window shadow, and costume position.
- macOS: verify transparent window and drag APIs.
- Right click always opens the menu, left button drags, cat cannot be clicked while equipped.
- No reappearing second cat while the costume is active.
- The costume follows Elise's idle, sit, and sleep positions.


## Option C selected — implementation update

The approved direction is **Option C**: gray-and-white sleepy cat mini-hood, pink-lined cat ears, fluffy cream edging, pink paw cuffs, and a gray-white tail with a dark bow and small golden bell. Elise retains her original long black hair, gray sweater, pleated skirt, black ribbon, socks, and shoes.

- `public/assets/costume/option-c/hood.svg`: redrawable vector mockup of the soft cat sleeping-cap with paw brooch and pompom.
- `public/assets/costume/option-c/tail.svg`: gray-white plush tail with ribbon and bell.
- `public/assets/costume/option-c/paw-cuff.svg`: pale pink paw-pad sleeve overlay.
- `src/App.tsx` and `src/style.css`: position these assets over the existing normal-form PNG poses and hide the independent cat while equipped.

**Art production caveat:** these are enhanced vector stand-ins, not extracted illustration layers from the selected concept sheet; their registration/alignment must be tested on actual Windows and macOS desktop windows. Create genuine hand-drawn pose-specific, alpha-transparent costume layers for production. No full transformation frame sequence is included yet.
