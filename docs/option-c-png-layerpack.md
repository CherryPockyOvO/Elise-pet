# Elise-pet | Option C PNG layer pack v2

This project now uses a registered transparent PNG layer compositor in `src/components/OptionCCharacter.tsx` for the **catgirl costume** state. The ordinary Elise + independent gray-white cat mode is unchanged.

## Required art paths
Put the 10 1024×1536 RGBA PNG files into:

`public/assets/costume/option-c/v2/`

Ordered assets:
1. `00_rear_tail.png`
2. `01_rear_twin_tail_left.png`
3. `02_rear_twin_tail_right.png`
4. `03_tail_ribbon_bell.png`
5. `04_elise_body_face.png`
6. `05_hood_base.png`
7. `06_hood_bow_paw_pin.png`
8. `07_hood_pompom.png`
9. `08_paw_cuff_left.png`
10. `09_paw_cuff_right.png`

All assets share **identical canvas dimensions and coordinates**: they are alpha overlays, not independently rescaled stickers. If images are missing, `OptionCCharacter` shows a normal-Elise fallback rather than broken images.

## Interaction
Right-click Elise to switch between independent cat and catgirl costume. Left-click drag still moves the desktop window. The temporary Option C CSS/SVG geometry has been removed from character rendering.

## Art status
These PNG parts were extracted from one full-height Option C illustration to preserve pixel-perfect alignment. They are **visible-pixel layers**, not fully painted PSD/Live2D layers; hidden portions still need drawing. In costume mode, sit and sleep options are temporarily disabled until pose-matched layer artwork is created. Do not reuse the flattened normal-mode poses as fake catgirl animation frames.

Assets are delivered separately as a ZIP to be placed into the repository and committed by the developer. MIT source-code licensing does not automatically grant unrestricted rights to the character artwork.
