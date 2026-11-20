# Elise-pet

Elise-pet 是基于 Tauri 2、React 19 和 TypeScript 的透明桌面宠物，角色为雨宮 雫（Amamiya Shizuku）。

## 当前功能

- 透明、无边框、置顶桌面窗口（macOS 通过 `macOSPrivateApi` 开启透明）
- 点击穿透：鼠标只有落在雫的不透明像素或面板上时窗口才接收点击，其余透明区域的点击会落到下面的桌面/窗口
- 雫正面待机时循环播放 `poses/standby/`，空闲时会随机做站立小动作、转身、短途散步或播放匯入动作
- 头顶对话气泡、头像随心情切换表情的菜单与聊天面板
- 散步前雫会先转到行进方向，再沿当前屏幕工作区走动。手动散步会逐段随机选方向和距离，可能在屏幕中途掉头。靠近边缘时会优先往里走
- 散步使用独立的活泼程度设置。每轮空闲优先检查站立小动作（正面默认 30%），其余轮次按懒散 10%、正常 25%、活泼 45% 检查散步，随后才播放该朝向抽到的其他动作。未抽到动作会保持当前朝向待机
- 在「动作管理」选择起始朝向后，点击「匯入 PNG 資料夾」即可导入至少两帧的序列。可在列表调整帧率、机率和结束朝向，左右朝向的导入动作也可以设为散步。删除动作会移除应用内保存的副本
- 散步循环播放 `poses/walk/`，基础速度为 20 FPS。转向使用 `poses/front2left/` 和 `poses/left2back/`，通过镜像和倒播补全各方向，也会用于随机回头
- 打开菜单、聊天或 API 管理时会暂停散步，关闭后继续。拖动桌宠会结束这一趟散步
- DeepSeek 多轮聊天，支持选择模型和思考力度。API Key 存在系统凭证库，余额通过官方接口查询
- 角色尺寸可在菜单中调整，设置保存在本机
- 「角色設定檔」提供基本资料、性格及两张概念图。界面与 DeepSeek 对话共用 `src/characterProfile.json`，聊天语气另由 `skills/amamiya-shizuku/SKILL.md` 定义
- 右键菜单的「螢幕」会列出已连接显示器和实际解析度。拖曳及散步都限制在选定屏幕的工作区，手动切换显示器后应用会记住选择

运行时按固定显示框等比绘制完整 PNG 画布。所有 640×640 动作帧共享同一个显示位置，保留素材原有留白。
更换动作帧时，把 PNG 放入对应目录并按播放顺序编号，例如 `frame_0001.png`、`frame_0002.png`。启动开发服务器或打包时会按文件名自然排序并读取实际帧数。
打包只内置 `walk`、`stand`、`standby`、`front2left` 和 `left2back` 的动作素材。匯入的 PNG 序列由应用保存在本机，每个匯入动作有独立的副本。

## 目录结构

- `src/App.tsx`：状态与动作；`src/PetMenu.tsx`、`src/ChatPanel.tsx`：菜单与聊天 UI
- `src/useWalker.ts`：散步动画与窗口移动；`src/useClickThrough.ts`：透明区域点击穿透
- `src/assets.ts`：所有图片路径与图标留白表
- `public/assets/elise/`：角色的姿势、表情、嘴型及概念图 PNG
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

- 左键按住并移动：拖动窗口
- 右键雨宮 雫：打开菜单，可以聊天、散步或查看「角色設定檔」
- 菜单里的「大小」可调整角色比例，「DeepSeek API」可管理密钥、余额和模型。保存 API Key 后，聊天时发送的消息和近期对话会提交给 DeepSeek
- 右键 →「动作管理」按四个起始朝向列出内建与导入动作，可设置 FPS、概率和结束朝向。各朝向的概率总和最多 100%，配置保存在本机。内建动作固定启用，导入动作可启用、停用或试播
- 转向只使用两组素材，镜像和倒播沿用对应素材的 FPS。左右组可导入散步帧，循环散步帧的首尾需接续。离散的原地动作可以按素材实际末帧设置结束朝向
- 导入的 PNG 会按文件名排序，并复制到本机应用数据的 `actions/front`、`left`、`back` 或 `right` 中。一个动作内请使用同尺寸的透明画布
- Esc：关闭菜单/聊天

## 素材说明

代码使用 MIT License。角色美术与生成素材请单独确认公开和再利用许可。
