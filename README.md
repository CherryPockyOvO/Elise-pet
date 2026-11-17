# Elise-pet

Elise-pet 是基于 Tauri 2、React 19 和 TypeScript 的透明桌面宠物。

## 当前功能

- 透明、无边框、置顶桌面窗口
- 左键拖动 Elise，右键打开菜单
- 独立猫咪形态与 Option C 猫娘形态切换
- 原版和猫娘版的站立、坐下、睡觉完整 PNG
- 猫娘站立时随机眨眼
- 本地聊天界面（AI API 尚未接入）

猫娘形态直接切换 `public/assets/costume/option-c/poses/` 中的完整 PNG，运行时不拼接帽子、袖口或尾巴。所有姿势使用 512×512 透明画布，并与原版对应姿势对齐。

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
- 左键猫咪：抚摸
- 右键猫咪：伸懒腰

## 素材说明

代码使用 MIT License。角色美术与生成素材请单独确认公开和再利用许可。
