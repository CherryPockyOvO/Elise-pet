# Elise-pet 🐾

A cross-platform AI desktop pet prototype starring Elise and her gray-and-white cat.

## v0.1.0 prototype

- Transparent, borderless, always-on-top window
- Draggable pet via top-right **拖動** control
- Click Elise to open a chat panel (local mock replies only)
- Click the cat to pet it; toggle sleep state
- Placeholder SVG illustrations (replace with original licensed artwork later)

**Important:** AI API integration, conversation persistence, system tray, Live2D, TTS, and macOS/Windows packaging are *planned*, not implemented in this first version.

## Development

Install Node.js 20+ (or compatible recent LTS), Rust, and the [Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```sh
npm install
npm run tauri dev
```

For a browser-only UI preview (without native dragging/window-close):

```sh
npm run dev
```

## Structure

- `src/` React UI and CSS
- `public/` temporary SVG placeholder art
- `src-tauri/` Tauri 2 native project and window permissions

## Licensing

Code is MIT licensed (see `LICENSE`). Original character designs, illustrations, animation sprites, and third-party assets are **not licensed under MIT** and must have separate permission before public distribution. The supplied temporary SVG illustrations in `public/` are project placeholders.

Never commit real API keys or secrets. Use secure OS credential storage when AI providers are added.
