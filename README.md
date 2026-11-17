# Elise-pet

Elise-pet 是基于 Tauri 2、React 19 和 TypeScript 的透明桌面宠物。

## 当前功能

- 透明、无边框、置顶桌面窗口（macOS 通过 `macOSPrivateApi` 开启透明）
- 点击穿透：鼠标只有落在 Elise、小猫的不透明像素或面板上时窗口才接收点击，其余透明区域的点击会落到下面的桌面/窗口
- 动作：站立、坐下、睡觉、散步、摸小猫（`pet_cat.png`）、被戳时吓一跳（`surprised.png`）、待机时偶尔换姿势（`idle_front_alt.png`）
- 小猫动作：坐、趴下（loaf）、打滚、挥手、伸懒腰、受惊、被摸时开心跳一下；待机时会随机做小动作
- 头顶对话气泡、头像随心情切换表情的菜单与聊天面板
- 散步时整个桌宠窗口沿屏幕工作区左右移动，走到边缘会转身（先转为正面，小猫绕到她前进方向一侧再出发）
- Elise 使用八帧走路 sprite sheet，以 `requestAnimationFrame` 驱动；每帧的前进距离按素材中着地脚的实际位移设定，脚不会打滑。走路帧已与 `idle_front.png` 统一身高与地面线，站立/走路切换不会跳动
- 小猫使用双帧 PNG 跟随散步；停止散步时 Elise 原地停下，小猫走回她右侧坐下
- 本地聊天界面（AI API 尚未接入）

运行时只切换 `public/assets/elise/poses/` 与 `public/assets/cat/poses/` 中的完整 PNG，不拼接角色部件。所有动作帧使用 512×512 透明画布。

## 目录结构

- `src/App.tsx`：状态与动作；`src/PetMenu.tsx`、`src/ChatPanel.tsx`：菜单与聊天 UI
- `src/useWalker.ts`：散步动画与窗口移动；`src/useClickThrough.ts`：透明区域点击穿透
- `src/assets.ts`：所有图片路径与图标留白表
- `public/assets/elise/`：Elise 的完整姿势、表情和嘴型 PNG
- `public/assets/cat/`：小猫的完整姿势和表情 PNG
- `public/assets/ui/`：界面图标
- `src-tauri/`：桌宠窗口（420×640）与 Tauri 配置

## 本地运行

需要 Node.js 与 Rust；Windows 另需 WebView2。macOS 使用 `npm run tauri dev`。

```powershell
npm.cmd install
npm.cmd run tauri -- dev
```

仅预览前端：

```powershell
npm.cmd run dev
```

构建检查：

```powershell
npm.cmd run build
cd src-tauri
cargo check --locked
```

## 操作

- 左键点一下 Elise：戳她（睡觉时会把她叫醒）
- 左键按住并移动：拖动窗口
- 右键 Elise 或小猫：打开菜单（Elise：聊天、散步、坐下、睡觉、戳一下；小猫：摸摸、打滚、挥手、伸懒腰、趴下）
- 左键小猫：摸摸它
- Esc：关闭菜单/聊天

## 素材说明

代码使用 MIT License。角色美术与生成素材请单独确认公开和再利用许可。
