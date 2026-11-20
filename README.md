# shizuku-pet

雨宮 雫（Amamiya Shizuku）的透明桌面寵物，使用 Tauri 2、React 19 和 TypeScript 製作。

## 功能

- 透明、無邊框、置頂的桌寵視窗（macOS 透過 `macOSPrivateApi` 開啟透明）
- 點擊穿透：只有游標落在雫的不透明像素或面板上時視窗才接收點擊
- 正面待機循環播放 `standby`，空閒時隨機做站立小動作、轉身、短途散步或播放匯入的動作
- 散步前先轉向行進方向，沿選定螢幕的工作區走動，靠近邊緣時優先往內走
- 「動作管理」可匯入 PNG 序列（至少兩幀），並按四個起始朝向設定 FPS、機率和結束朝向
- DeepSeek 多輪聊天，可選模型和思考力度；API Key 存在系統憑證庫
- 「角色設定檔」顯示基本資料、性格與概念圖
- 可調整角色大小、選擇顯示器，設定保存在本機

## 目錄結構

```text
character/                 角色資料（介面與 DeepSeek 共用）
  profile.json             基本資料、性格、日常
  persona.md               聊天語氣與扮演規則（編譯時嵌入 system prompt）
public/assets/
  shizuku/poses/<動作>/    內建動作幀：walk、stand、standby、front2left、left2back
  shizuku/expressions/     選單與聊天頭像表情
  shizuku/concept/         角色設定檔的概念圖
  icons/                   介面圖示
src/
  App.tsx                  狀態與動作排程
  components/              選單、聊天、動作管理、DeepSeek、設定檔等 UI
  hooks/                   useWalker（散步與轉身）、useClickThrough、usePetDisplay
  lib/                     素材路徑、轉身幀、動作設定、本機偏好
src-tauri/                 Rust 端：視窗設定、動作匯入/刪除、DeepSeek API
tools/comfyui_shizuku_green_screen/
                           ComfyUI 綠幕去背節點（製作動作素材用，不參與打包）
app-icon.png               用 `npm run tauri icon app-icon.png` 重新產生 src-tauri/icons
```

## 本地執行

需要 Node.js 與 Rust；Windows 另需 WebView2。

```bash
npm install
npm run tauri dev
```

只預覽前端（不含原生視窗、聊天與匯入）：

```bash
npm run dev
```

建置檢查：

```bash
npm run build
cd src-tauri && cargo test --locked
```

## 打包成應用程式

```bash
npm install
npm run tauri build
```

產物位於 `src-tauri/target/release/bundle/`：

| 平台 | 產物 | 說明 |
| --- | --- | --- |
| macOS | `macos/Shizuku Pet.app`、`dmg/Shizuku Pet_<版本>_<架構>.dmg` | 把 `.app` 拖進「應用程式」即可雙擊啟動 |
| Windows | `nsis/Shizuku Pet_<版本>_x64-setup.exe`、`msi/*.msi` | 安裝程式會在需要時下載 WebView2 |

- 每個平台要在該平台上打包：`.exe` 需在 Windows（裝好 Node.js、Rust、Visual Studio C++ Build Tools）執行同樣的指令。
- macOS 產物只有 ad-hoc 簽名。自己打包的 `.app` 可直接開啟；傳給別人時對方第一次需要在 Finder 右鍵 →「打開」，或到「系統設定 → 隱私權與安全性」允許。要免除這一步需 Apple Developer 帳號簽名並公證。
- Apple Silicon 預設產出 `aarch64` 版本；要給 Intel Mac 用，先 `rustup target add x86_64-apple-darwin`，再執行 `npm run tauri build -- --target universal-apple-darwin`。

## 操作

- 左鍵按住移動：拖動雫
- 右鍵雫：開啟選單（聊天、散步、角色設定檔、大小、螢幕、動作管理、DeepSeek API）
- Esc：關閉選單

## 動作素材

- 內建動作放在 `public/assets/shizuku/poses/<動作>/`，按播放順序命名為 `frame_0001.png`、`frame_0002.png`……。啟動或打包時按檔名自然排序並讀取實際幀數。
- 所有幀使用 640×640 透明畫布，共用同一個顯示位置。
- 轉身只用 `front2left` 與 `left2back` 兩組素材，透過鏡像和倒播補全其他方向。
- 匯入的動作會複製到本機應用資料夾的 `actions/<朝向>/`，不放進倉庫。

## 授權

程式碼使用 MIT License。角色美術與生成素材請另行確認公開與再利用許可。
