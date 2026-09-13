# ZCode 初音未来主题 (Hatsune Miku Skin for ZCode)

非官方、非商业的粉丝二创主题。通过 Chromium 调试端口（仅 127.0.0.1 回环 + 固定端口 39517）向 ZCode 桌面端注入 CSS，实现日夜双形态换肤 + **雨夜城市背景**（♪ 面板可换图/调虚化/调亮度/总开关）+ 初音未来立绘 + 呼吸光效 + 悬停淡出 + 音符动效。**不修改任何程序文件，卸载即恢复原版。**

- 适配版本：本机 ZCode 3.11.2.6792（Electron 41）实测可用；其它版本未验证
- 主题仓库目录：`C:\Users\Lenovo\.zcode\workspace\default\miku-theme\`

## 快速使用（已配置免操作自启）

日常使用**无需任何操作**：ZCode 的开始菜单快捷方式已带挂载参数，开机后由启动文件夹里的 `zcode-miku-watch.vbs` 自动运行注入监督进程（固定端口 39517）。你正常打开 ZCode，主题会在窗口出现后约 3 秒内自动附上，日间/夜间形态跟随应用设置。

| 操作 | 方式 |
|---|---|
| **日常打开** | 像平常一样打开 ZCode（快捷方式已带参数，自动挂主题） |
| **手动给当前实例挂载** | 双击 `mount.cmd`（应用已在跑但没有端口时，会重启一次） |
| **后台静默挂载** | `mount-hidden.vbs`（无任何窗口，供计划任务/脚本调用） |
| **临时恢复原版** | 双击 `unmount.cmd`（下次正常打开会再次自动挂上） |
| **彻底移除自启** | 运行 `teardown-autostart.ps1`（还原快捷方式、删除自启、停止注入器） |
| **重新启用自启** | 运行 `setup-autostart.ps1` |

窗口宽度 <1020px 或高度 <620px 时立绘自动隐藏，不影响小窗使用。

## 文件说明

```
miku-theme/
├─ mount.cmd / mount.ps1        挂载入口（关应用→带调试端口重启→注入→验证截图）
├─ mount-hidden.vbs             静默挂载入口（无窗口，供计划任务/脚本调用）
├─ unmount.cmd / unmount.ps1    卸载入口（停注入器→重启应用→恢复原版）
├─ setup-autostart.ps1          配置免操作自启（改快捷方式参数 + 启动文件夹自启）
├─ teardown-autostart.ps1       移除免操作自启（还原快捷方式、删自启、停注入器）
├─ theme/miku-theme.css         主题本体（覆盖 ZCode 的 --color-* 设计令牌，265 个变量体系）
├─ scripts/miku-inject.mjs      CDP 注入器（--forever 监督模式常驻巡检；单实例锁）
├─ scripts/redeploy.mjs         热更新：清挂载标记让监督进程用最新主题文件重注入（不重启应用）
├─ scripts/shot.mjs             截取当前应用窗口（调样式用）
├─ scripts/panel.js             背景设置面板（图库缩略图/虚化/亮度滑条，设置存 localStorage）
├─ scripts/check-state.mjs      查看当前注入状态
├─ scripts/gen-pixel-bg.mjs     自制像素画生成器（默认背景来源，可自由分发）
├─ backgrounds/                 你的背景图库（gitignore，不入仓库）：丢进任何 jpg/png/webp（<8MB）即出现在 ♪ 面板里
├─ assets/pixel-bg.jpg          默认背景：雨夜城市窗边的初音场景
├─ assets/pixel-bg.png          备用背景：自制像素风 Miku 房间（gen-pixel-bg.mjs 生成，可自由分发）
├─ assets/miku-v4x.png          初音未来立绘（官方画师 iXima 绘制的 V4X 立绘，透明底，来自萌娘百科）
├─ mock/dark.html · light.html  本地预览页（用真实样式表模拟界面，可双击打开看效果）
└─ mount.log / state.json / verification.png / scripts/injector.lock   运行时产物（gitignore）
```

## 背景图与设置面板

日间和夜间模式都会显示背景，风格自动切换：夜间是雨夜城市的深色虚化薄纱（brightness 1.15）；日间做"浅色玻璃"处理（提亮 + 32% 不透明度的水色剪影），深色文字不受影响。按页面自动切换形态：

- **新建任务首页**：背景清晰展示（无虚化）；
- **任务/对话等其它页面**：背景虚化，保证工作区文字可读；
- 注入器每 0.8 秒检测当前页面并平滑切换。

**换图/调参**：点应用右下角的 **♪ 按钮**打开背景设置面板：
- **显示背景图**：总开关，暂时不想要背景随时关；
- **＋ 从电脑选择图片…**：弹出 Windows 文件选择框，选中即用（最近 6 张会保留在列表里，悬停可点 × 移除）；
- 图库列表：`backgrounds/` 文件夹里的图片 + 你选过的自定义图，点击切换；
- **虚化 / 亮度滑条**：实时预览；任务页和首页的参数**分别记忆**（存 localStorage），重启应用后自动恢复。

默认背景是**雨夜城市窗边的初音场景**（项目自带）。想用自己的图：直接用 ♪ 面板的"从电脑选择图片"（仅保存在本地 localStorage，不会进入仓库），或把图片放进 `backgrounds/` 文件夹（该文件夹已被 gitignore，请勿将版权图提交到仓库）。想调虚化/明暗：用面板滑条，或改 `theme/miku-theme.css` 里 `#zcode-miku-bg img` 的 filter 两行。

## 工作原理与安全边界

1. **注入方式**：`mount.ps1` 以 `--remote-debugging-port=<随机端口> --remote-allow-origins=*` 重启 ZCode，注入器通过 CDP 的 `CSS.createStyleSheet` 注入主题（不受页面 CSP 限制），并每 10 秒巡检补挂（应对页面刷新）。这与嘉然多应用启动器给 ZCode 挂载的思路一致。
2. **只作用于应用自身页面**：注入器按 URL 匹配 `index.html`（应用渲染层），**不会**影响 ZCode 内嵌浏览器打开的网页。
3. **端口安全**：仅绑定 127.0.0.1 回环 + 随机高位端口。⚠️ 挂载期间该端口允许本机任意进程读取页面内容，属实验性本地调试能力；**卸载（重启应用）后端口即关闭**。请勿在挂载状态处理高度敏感内容。
4. **应用更新**：ZCode 更新后令牌名或界面结构可能变化，主题或需重新适配；届时重新运行 `mount.cmd` 若样式异常，先 `unmount.cmd` 恢复。

## 已知限制

- 主题依赖启动参数里的调试端口：**必须通过带参数的快捷方式启动**才会自动挂载。若从其它入口启动（如协议唤起、别的启动器），主题不会出现，此时双击 `mount.cmd` 补救即可。
- 卸载自启用 `teardown-autostart.ps1`；`unmount.cmd` 只恢复当前会话。
- 强制关闭应用使用 `taskkill`，不会丢失会话数据（任务与对话持久化在磁盘），但仍建议先保存正在编辑的文件。
- 挂载期间调试端口（仅 127.0.0.1 回环、固定 39517）允许本机进程读取页面内容；彻底移除请用 `teardown-autostart.ps1`。
- ZCode 应用更新后令牌名或界面结构可能变化，主题或需重新适配；样式异常时先 `teardown-autostart.ps1` + `unmount.cmd` 恢复。

## 致谢与声明

- 初音未来（初音ミク）角色形象 © Crypton Future Media, INC.；本主题按 Piapro Character License 用于非商业粉丝二创，请勿商用。
- 立绘：iXima 绘制的初音未来 V4X 官方立绘（透明底），经萌娘百科镜像获取。
- 灵感与思路致谢：[diana-multi-app-launcher](https://github.com/lanmengSakura/diana-multi-app-launcher)（嘉然多应用主题启动器）。
