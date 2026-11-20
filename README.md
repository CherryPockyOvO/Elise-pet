# shizuku-pet

雨宮 雫（Amamiya Shizuku）的透明桌面寵物，使用 Tauri 2、React 19 和 TypeScript 製作。

## 功能

- 透明、無邊框、置頂的桌寵視窗（macOS 透過 `macOSPrivateApi` 開啟透明）
- 點擊穿透：只有游標落在雫的不透明像素或面板上時視窗才接收點擊
- 四個朝向各有待機循環（`standby_front`、`standby_left`、`standby_right`、`standby_back`），空閒時隨機轉身、短途散步或播放匯入的動作
- 散步前先轉向行進方向。從選單開始的散步會一直走到螢幕邊緣才掉頭，直到按「停下」；空閒時的短途散步走一段就停。不論哪種，都會在雙腳併攏的那一幀停下或轉身
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
  shizuku/poses/<動作>/    內建動作幀：walk、standby_*、四組轉身、選用的 stand
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

- 內建動作放在 `public/assets/shizuku/poses/<動作>/`（`walk`、四組轉身、四組 `standby_<朝向>` 必須有；`stand` 選用），按播放順序命名為 `frame_0001.png`、`frame_0002.png`……。啟動或打包時按檔名自然排序並讀取實際幀數。
- 同一組動作的幀使用同尺寸的正方形透明畫布，共用同一個顯示位置。
- 左右以雫自己的方向為準：`front2left` 結束時面向螢幕右邊，`front2right` 結束時面向螢幕左邊。
- 轉身由四組素材組成，只會正放或倒放，不會鏡像：

  | 資料夾 | 內容 | 倒放用於 |
  | --- | --- | --- |
  | `front2left` | 正面 → 左側 | 左側 → 正面 |
  | `front2right` | 正面 → 右側 | 右側 → 正面 |
  | `left2back` | 左側 → 背面 | 背面 → 左側 |
  | `right2back` | 右側 → 背面 | 背面 → 右側 |

  四組轉身在「動作管理」各自一列，可分別設定 FPS 與機率。
  四個資料夾都必須有至少兩幀，否則建置會失敗。相鄰兩組的接續幀（例如 `front2right` 的末幀與 `right2back` 的首幀）要一致。`stand` 是選用的，沒有幀時不會出現在動作清單。
- 每個朝向停下來時循環播放對應的 `standby_<朝向>`。首幀要接得上轉身素材的最後一幀，末幀要接回首幀。待機播到一半要開始動作時，會先以三倍速播回最接近首幀的姿勢再開始，所以循環中段的動作幅度不必顧慮銜接。
- `walk` 畫成面向螢幕右邊、原地踏步的循環。程式會量出平均每幀著地腳後退的距離，散步時視窗以相同的平均速度平滑移動，所以不用手動調速度；首尾兩幀要能接續。程式也會找出雙腳併攏的幀，起步、停下和掉頭都落在這些幀上。往螢幕左邊走時目前仍會鏡像 `walk`。
- 匯入的動作會複製到本機應用資料夾的 `actions/<朝向>/`，不放進倉庫。

## 授權

程式碼使用 MIT License。角色美術與生成素材請另行確認公開與再利用許可。
