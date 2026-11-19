# Elise-pet

Elise-pet 是基于 Tauri 2、React 19 和 TypeScript 的透明桌面宠物。

## 当前功能

- 透明、无边框、置顶桌面窗口（macOS 通过 `macOSPrivateApi` 开启透明）
- 点击穿透：鼠标只有落在 Elise、小猫的不透明像素或面板上时窗口才接收点击，其余透明区域的点击会落到下面的桌面/窗口
- 动作：站立待机、坐下、睡觉、散步、摸小猫（`pet_cat.png`）、被戳时吓一跳（`surprised.png`）
- 小猫动作：坐、趴下（loaf）、打滚、挥手、伸懒腰、受惊、被摸时开心跳一下；待机时会随机做小动作
- 空闲时 Elise 会看看四周、摸小猫、小坐、打盹或沿当前屏幕短途散步。手动选择的坐姿和睡姿会保留
- 头顶对话气泡、头像随心情切换表情的菜单与聊天面板
- 散步前 Elise 会先转到行进方向，再沿当前屏幕工作区走动。手动散步会逐段随机选方向和距离，可能在屏幕中途掉头。靠近边缘时会优先往里走
- Elise 默认显示 `poses/idle_front.png`。待机动作按当前朝向的机率配置抽选，先分配站立小动作（默认 30%），再分配走路和转向，最后分配其他动作。未配置的机率保持待机
- 散步循环播放 `poses/walk/`，基础速度为 20 FPS。转向使用 `poses/front2left/` 和 `poses/left2back/`，通过镜像和倒播补全各方向，也会用于随机回头
- 小猫使用双帧 PNG 跟随散步；停止散步时 Elise 原地停下，小猫走回她右侧坐下
- 打开菜单、聊天或 API 管理时会暂停散步，关闭后继续。拖动桌宠会结束这一趟散步
- DeepSeek 多轮聊天，支持选择模型和思考力度。API Key 存在系统凭证库，余额通过官方接口查询
- Elise 和小猫的尺寸可在菜单中调整，设置保存在本机

运行时切换 `public/assets/elise/poses/` 与 `public/assets/cat/poses/` 中的完整透明 PNG。Elise 的默认站姿、待机动作、走路和转向素材使用 640×640 画布，其他静态姿势和小猫使用 512×512。
更换动作帧时，把 PNG 放入对应目录并按播放顺序编号，例如 `frame_0001.png`、`frame_0002.png`。启动开发服务器或打包时会按文件名自然排序并读取实际帧数。

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
- 菜单里的「大小」可调整角色比例，「DeepSeek API」可管理密钥、余额和模型。保存 API Key 后，聊天时发送的消息和近期对话会提交给 DeepSeek
- 右键 →「动作管理」按四个起始朝向列出内建与导入动作，可设置 FPS、概率和结束朝向。各朝向的概率总和最多 100%，配置保存在本机。内建动作固定启用，导入动作可启用、停用或试播
- 转向只使用两组素材，镜像和倒播沿用对应素材的 FPS。左右组可导入散步帧，循环散步帧的首尾需接续。离散的原地动作可以按素材实际末帧设置结束朝向
- 导入的 PNG 会按文件名排序，并复制到本机应用数据的 `actions/front`、`left`、`back` 或 `right` 中。一个动作内请使用同尺寸的透明画布
- 左键小猫：摸摸它
- Esc：关闭菜单/聊天

## 素材说明

代码使用 MIT License。角色美术与生成素材请单独确认公开和再利用许可。
