# Elise Green Screen for ComfyUI

將整個 `comfyui_elise_green_screen` 資料夾放到 `ComfyUI/custom_nodes/`，重啟 ComfyUI，再搜尋 **Elise Green Screen**。執行 ComfyUI 的電腦需要能透過 `PATH` 執行 Node.js。在同一個終端執行 `node --version` 可以確認。Python 使用 ComfyUI 已有的 PyTorch 和 NumPy。

## 接線

把 AnimateDiff、超分節點或影片解碼節點產生的 `IMAGE` 批次接到 `images`。節點按批次順序逐幀去背，保持解析度和幀數。24 FPS 等播放資訊請在原影片載入器或匯出端設定。

```text
影片解碼 / AnimateDiff / 超分 IMAGE → Elise Green Screen → rgba_images → Save Image
```

- `rgba_images` 是四通道 `IMAGE`，可直接接 `Save Image` 輸出透明 PNG 序列。
- `rgb_images` 是去綠後的三通道 `IMAGE`，可接需要 RGB 的節點。
- `background_mask` 是 `MASK`，白色代表透明背景，黑色代表保留前景。也能與 `rgb_images` 一起接到 `Join Image with Alpha`。

## 參數

- `green_level = 0` 從每幀左右取樣綠幕。固定的綠底也可指定 100–255 的 `G - max(R,B)`。
- `edge_start = 0.03` 決定從哪裡開始淡化，`clear = 0.89` 決定何時全透明。
- `trim_sides = 0` 保留整張畫布的左右邊緣。要重現先前 MiniMax 00007 的匯出設定，可設為 `8`，只將最左與最右各 8 px 變透明，畫布仍是 1024 × 1024。

這個節點適用於畫面兩側都看得到的均勻綠幕。鮮綠服飾或道具需要額外的前景遮罩。較長的 1024 影片可以在上游分批送入，降低整批 `IMAGE` 與 `MASK` 的記憶體占用。
