# 綠幕去背

`green-screen.mjs` 保存了用來處理 `MiniMax_H3_00007_.mp4` 的核心算法。它會掃描整張畫面，包括被髮絲包住的空隙，並在半透明邊緣參考附近的前景顏色與亮度來去綠。模組可在瀏覽器或 Node.js 使用，無需額外套件。

ComfyUI 可安裝同目錄的 [`comfyui_elise_green_screen`](./comfyui_elise_green_screen/README.md)，直接處理 `IMAGE` 批次並輸出透明 PNG。

## 接到流水線

用解碼器按播放順序讀取原始幀，將每幀轉為連續的 `Uint8ClampedArray` RGBA。`keyGreenScreen` 會就地改寫 RGB 和透明度，保留幀的寬高。傳入資料應使用直通 alpha，也就是 RGB 值尚未乘上透明度。

```js
import { keyGreenScreen } from './green-screen.mjs';

// ctx 對應一個與解碼畫面同尺寸的 Canvas，video 已停在要處理的那一幀。
ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
ctx.drawImage(video, 0, 0);
const frame = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
const stats = keyGreenScreen(frame);
ctx.putImageData(frame, 0, 0);
// 用 canvas.toBlob(callback, 'image/png') 匯出帶透明度的 PNG。
```

整批應保留原本的播放順序與幀率。若桌寵需要較小的畫布，先以原尺寸去背，再縮放帶透明度的畫面。上次處理 MiniMax 時也另外清除了畫布左右各 8 像素，當時角色與兩側都有充足留白，這個步驟留給流水線按素材決定。

## 調整參數

| 選項 | 預設 | 說明 |
| --- | --- | --- |
| `greenLevel` | 從左右邊緣取樣 | 綠底的 `G - max(R, B)`，範圍為 100–255。固定機位可從一張代表幀取得 `stats.screen`，沿用到其餘幀。 |
| `edgeStart` | `0.03` | 開始淡化的相對門檻。調高可保留更多輕微偏綠的邊緣。 |
| `clear` | `0.89` | 完全透明的相對門檻。調低會扣掉更多綠色，先在細髮處試看。 |

預設假設背景綠色出現在畫面左右，且角色沒有需要保留的鮮綠區域。有綠色服飾或道具的素材需要額外的前景遮罩。`removed` 是全透明像素數，`interior` 是全不透明像素數，`corrected` 是走過邊緣色彩處理的像素數，可記錄下來檢查批次中異常的幀。
