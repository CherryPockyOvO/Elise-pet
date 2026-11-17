# Elise-pet

Elise-pet 是基于 Tauri 2、React 19 和 TypeScript 的透明桌面宠物。

## 当前功能

- 透明、无边框、置顶桌面窗口
- 左键拖动 Elise，右键打开菜单
- Elise 与独立小猫始终一起显示，小猫固定在人物脚边
- 原版站立、坐下、睡觉与侧面走路完整 PNG
- Elise 和小猫使用同步双帧行走动画，可在窗口内往返散步
- 本地聊天界面（AI API 尚未接入）

运行时只切换 `public/assets/elise/poses/` 与 `public/assets/cat/poses/` 中的完整 PNG，不拼接角色部件。所有动作帧使用 512×512 透明画布。

## 目录结构

- `src/`：React 交互与界面样式
- `public/assets/elise/`：Elise 的完整姿势、表情和嘴型 PNG
- `public/assets/cat/`：小猫的完整姿势和表情 PNG
- `public/assets/ui/`：界面图标
- `src-tauri/`：Windows 桌宠窗口与 Tauri 配置

## 本地运行

需要 Node.js、Rust 和 Windows WebView2 开发环境。

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

- 左键按住 Elise：拖动窗口
- 右键 Elise：打开菜单
- 菜单「一起散步」：开始或停止 Elise 与小猫的同步行走
- 左键猫咪：抚摸
- 右键猫咪：伸懒腰

## 素材说明

代码使用 MIT License。角色美术与生成素材请单独确认公开和再利用许可。
