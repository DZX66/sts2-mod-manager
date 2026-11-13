# CLAUDE.md

本文件为 Claude Code / AI 代理在本仓库工作时的上下文指引。

## 1. 项目是什么

**STS2 Mod Manager** —— 杀戮尖塔 2（Slay the Spire 2，Steam AppID `2868840`）的 MOD 管理器桌面应用。

它是 [ImogeneOctaviap794/sts2-mod-manager](https://github.com/ImogeneOctaviap794/sts2-mod-manager) 的增强 fork，由 DZX66 维护。核心能力：

- MOD 的安装 / 卸载 / 启用 / 禁用（支持拖拽 `.zip`）
- 创意工坊（Workshop）订阅检测与启用状态接管
- MOD 加载顺序管理，并可写回游戏的 `settings.save`
- 依赖缺失检查、`min_game_version` 兼容性检查、风险分类
- 配置档案（Profile）的保存 / 切换 / 导入导出
- 存档（普通 / MOD 存档）的备份、导出、导入
- 游戏日志查看与崩溃分析、MOD 描述翻译、自定义标签、备注
- 中英双语 UI + 明暗主题

**当前架构是 Tauri v2**。历史上的 Electron 版本已被删除（commit `3e9ecad delete electron`），但残留物仍在仓库里，见第 9 节。

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18（函数组件 + Hooks）、TailwindCSS 3（`darkMode: 'class'`）、lucide-react 图标、react-colorful（标签取色） |
| 后端 | Rust 2021 + Tauri v2（`tauri`, `tauri-plugin-dialog/opener/fs`） |
| 打包 | NSIS 安装包（`installMode: currentUser`）+ 便携 exe，内嵌 WebView2 bootstrapper |
| 前端构建 | webpack 5 + babel（`@babel/preset-env/react`）、PostCSS + Tailwind |
| 平台 | 仅 Windows 实测（大量 `#[cfg(target_os = "windows")]`、`cmd /C start`、`%AppData%` 路径探测） |

关键依赖：`serde`/`serde_json`、`zip 2`、`reqwest 0.12`、`tokio`、`dirs 6`、`encoding_rs`、`sysinfo`、`chrono`、`urlencoding`、`opener`。

## 3. 目录结构

```
src/                     前端源码（React）
  App.jsx                主容器：全部应用状态、页面路由、弹窗、筛选排序（约 1560 行，单文件巨石）
  index-tauri.jsx        Tauri 入口：初始化主题 → 挂载 <I18nProvider><App/>
  index.html             Electron 时代的入口（未被 Tauri 使用，见第 9 节）
  index.jsx              Electron 时代入口（未被使用）
  tauri-api.js           ★ 前后端桥接层，把 invoke 包装成 window.api.*
  index.css              Tailwind 指令 + react-colorful 静态样式（勿删，见 6.6）
  output.css             Tailwind 构建产物（已入库）
  components/            展示型组件（无全局状态，数据经 props 下传）
    Sidebar.jsx  TitleBar.jsx  ModCard.jsx  ModListItem.jsx
    ModDetail.jsx  ModLoadOrder.jsx  ModTags.jsx
    SaveManager.jsx  SettingsPage.jsx  LogViewer.jsx
  i18n/                  I18nContext.js / useI18n.js / zh-CN.json / en-US.json
  utils/deps.jsx         版本比较、依赖满足检查、min_game_version 检查
  assets/                图片资源（webpack asset/resource → dist-tauri/assets/）

src-tauri/               后端源码（Rust）
  src/main.rs            进程入口：写 launch.log、catch_unwind、Windows 错误弹窗
  src/lib.rs             ★ Tauri Builder、AppState、所有 command 的注册表、窗口/Shell 命令
  src/config.rs          游戏路径探测（Steam 库 VDF）、config.json、app_init
  src/mods.rs            ★ 最大的模块（约 1300 行）：扫描、解析 manifest、启停、卸载、安装/解压、备份还原
  src/steam.rs           Steam 用户扫描、settings.save 读写、创意工坊目录扫描
  src/load_order.rs      加载顺序持久化、智能排序、写回 settings.save
  src/profiles.rs        档案增删改、导入导出（JSON / 文件 / 剪贴板）
  src/tags.rs  src/notes.rs  src/translations.rs   单文件 JSON 键值存储
  src/saves.rs           存档槽位扫描、导出/导入 zip、自动备份
  src/logs.rs            日志读取、崩溃日志解析、MOD 角色名推断
  src/game.rs            启动游戏、进程状态轮询、游戏版本探测、崩溃分析
  src/diagnostic.rs      诊断报告导出（系统信息 + settings.save + 目录树 + 日志）
  src/translate.rs       MyMemory 翻译 API 调用
  tauri.conf.json        ★ 应用版本号与打包配置的唯一来源
  gen/schemas/           Tauri 生成的 schema（已入库，勿手改）
  icons/                 应用图标
  target/                构建产物（已 gitignore）

dist-tauri/              前端构建输出，也是 Tauri 的 frontendDist（部分文件已入库）
  index.html             手写维护，引用 renderer.js + output.css
  renderer.js            webpack 主包（gitignore）
  318/964.renderer.js    i18n JSON 的异步 chunk（已入库，勿手删）
  output.css             由 build:tauri-fe 从 src/ 复制过来

dist/                    Electron 时代的构建产物（遗留，已入库）
scripts/ci/gh_publish.py 打 tag 后自动生成 Release 的脚本
docs/                    README 截图 + 中文 README
```

## 4. 构建 / 运行 / 验证

**必须用 Tauri 脚本。** `npm run build` 与 `npm run dev` 都不可用（见第 9 节）。

```bash
npm install                # 安装依赖（CI 用 npm ci）
npm run tauri:dev          # 构建前端 + tauri dev（无 HMR，见下）
npm run tauri:build        # 构建前端 + tauri build → NSIS 安装包 + 便携 exe
npm run build:tauri-fe     # 仅构建前端到 dist-tauri/（调试 UI 时最常用）
```

环境要求：Node（CI 用 22）+ Rust stable + VS Build Tools（勾选 C++ 桌面开发）。

**关于热更新**：`tauri.conf.json` 只配了 `frontendDist: "../dist-tauri"`，没有 `devUrl`，所以 `tauri dev` 加载的是静态 bundle。**改前端后必须重新执行 `npm run build:tauri-fe`（或重启 `tauri:dev`），不存在页面自动刷新。**

**验证方式**：仓库没有测试套件、没有 ESLint/Prettier/rustfmt 配置。提交前至少做：

```bash
cd src-tauri && cargo check        # Rust 编译（当前基线：0 error / 3 unused 警告）
npm run build:tauri-fe             # 前端打包（当前基线：2 个体积 warning，可忽略）
```

涉及实际行为时必须手工启动应用验证（这是 Windows 桌面应用，需要真实游戏目录 / Steam 环境）。

**版本号**：用户看到的版本只来自 `src-tauri/tauri.conf.json` 的 `version`（当前 `1.5.3`）。`package.json` 与 `src-tauri/Cargo.toml` 里都还是 `1.0.0`，是历史遗留，改版本号时不必同步（但也不要基于它们判断版本）。

## 5. 前后端契约（最重要的约定）

### 5.1 桥接层是唯一入口

前端**不直接**调用 `invoke`，一律通过 `window.api.*`（定义在 [src/tauri-api.js](src/tauri-api.js)）。新增命令时必须三处同时改：

1. `src-tauri/src/xxx.rs` 里写 `#[tauri::command] pub fn ...`
2. `src-tauri/src/lib.rs` 的 `invoke_handler(generate_handler![...])` 里注册（**漏了就是运行时报 not found**，编译期不会报错）
3. `src/tauri-api.js` 的 `window.api` 对象里加薄包装

### 5.2 命名转换

- Rust 结构体字段用 `snake_case`，对外一律用 `#[serde(rename = "...")]` 转成 `camelCase`（如 `folderName`、`isFolder`、`modType`、`min_game_version` 例外地保持 snake_case）。前端全程使用 camelCase。
- Tauri v2 会把 JS 传参的 camelCase 自动映射到 Rust 的 snake_case 参数名，例如 `invoke('config_set', { newConfig: config })` → `config_set(new_config: Config)`。跟随时保持一致风格。

### 5.3 返回值形态不统一（既有现状）

| 风格 | 例子 | 前端处理 |
|---|---|---|
| 裸数据 | `mods_scan` → `Vec<ModInfo>`、`app_init` → `InitResult`、`game_get_state` → `String` | 直接当值用 |
| `{success, error, mods, installed}` | `mods_toggle`、`mods_install`、`mods_backup` | `if (result.success)`，失败时 `showToast(result.error)` |
| `Result<T, String>` | `saves_export`、`export_diagnostic_report` | 需 try/catch |

`ModResult` 里的 `mods` 字段会在操作后携带的最新全量列表，前端优先用它替换本地 state（`syncMods(result.mods)`），否则回落到 `refreshMods()`。**新增写操作命令时请沿用这个模式，避免多次全量扫描。**

### 5.4 全局状态

`AppState`（[src-tauri/src/lib.rs](src-tauri/src/lib.rs)）只有两个 `Mutex`：

- `game_path: Option<String>` — 所有命令从它取游戏目录；**未设置时几乎所有命令都返回 `success: false`**。取值后要立即 `drop(gp)` 再继续，否则后续再 `lock()` 会死锁（现有代码在长函数开头都有这个 `clone()` + `drop()` 模式，务必照抄）。
- `game_state: "idle" | "launching" | "running"` — 由前端每 2 秒轮询 `game_get_state` 驱动状态机。

## 6. 前端约定

### 6.1 状态与组件分工

- 全部应用状态集中在 [src/App.jsx](src/App.jsx)：`page`、`mods`、`selectedMod`、`profiles`、`tagsData`、`loadOrder`、各类 `show*` 弹窗开关。
- `components/` 下的组件**基本是受控展示层**，通过 props 接收数据与回调，自己不持有持久状态（`ModLoadOrder`、`SaveManager`、`SettingsPage`、`LogViewer` 例外，它们各自独立加载数据）。
- 页面切换是 `App.jsx` 里的 `{page === 'mods' && (...)}` 条件渲染，没有路由库。`page` 取值：`mods` / `loadorder` / `saves` / `logs` / `settings`。

### 6.2 国际化（强制）

- 所有 UI 文案走 `const { t } = useT()`（来自 [src/i18n/I18nContext.js](src/i18n/I18nContext.js)），**不要在 JSX 里硬编码中文或英文**。
- 键是点分命名空间：`t('mods.installMod')`、`t('nav.mods')`。支持插值：`t('mods.summary', { total, enabled })`，对应 JSON 里的 `{total}`。
- **缺失键会静默返回键名本身**（`t('a.b') === 'a.b'`），不会报错 —— 所以新增文案后必须肉眼确认渲染正常。
- `zh-CN.json` 与 `en-US.json` 的叶子键必须**严格 1:1**（当前各 356 个，16 个顶层命名空间）。改一个就要改另一个。
- 顶层命名空间：`app` `nav` `mods` `modCard` `modDetail` `logViewer` `saveManager` `settings` `crashDialog` `missingModsDialog` `updateDialog` `confirmDialog` `character` `loadOrder` `profileImport` `common`。
- 语言检测：`navigator.language` 以 `zh` 开头 → `zh-CN`，否则 `en-US`；持久化在 `localStorage['sts2-locale']`。

### 6.3 明暗主题

`tailwind.config.js` 用 `darkMode: 'class'`。写任何配色类时必须成对给出暗色版本：

```jsx
className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
```

主题模式（light / dark / system）由 `document.documentElement.classList.toggle('dark', ...)` 控制，初始化在 `src/index-tauri.jsx`，持久化在 `localStorage['sts2-theme']`。

### 6.4 文案与反馈

- 轻量反馈统一用组件内的 `showToast(msg, type='success'|'error')` + `setTimeout` 清理（各组件各自实现一份，属于既有重复，不必强行抽取）。
- **破坏性操作必须先弹确认框并说明后果**：卸载、批量卸载、应用档案、还原备份都走 `setConfirmDialog({...})`。新增同类操作请沿用。

### 6.5 本地存储键

新增 `localStorage` 键请统一 `sts2-` 前缀。现有：`sts2-theme`、`sts2-locale`、`sts2-update-dismissed`、`sts2-workshop-warning-dismissed`、`sts2-load-order-write-settings`。

### 6.6 样式构建注意

- Tailwind `content: ['./src/**/*.{js,jsx,html}']` —— 放进 `src/` 之外的文件不会被扫描，动态拼接的类名（如 `bg-${color}-50`）也不会。需要动态颜色时用内联 `style`（参考 `ModTags.getDefaultTagStyle`）。
- `src/index.css` 里内联了一整套 react-colorful 样式，注释说明是为了绕过 WebView 对 style-loader 动态注入 `<style>` 的限制。**不要删除或改回从包内引入。**

## 7. 后端约定

- 每个领域一个模块，命令函数 `pub fn xxx(...)` + `#[tauri::command]`，全部集中在 `lib.rs` 注册并按注释分组（App / Window / Mods / Shell / Game / Logs / Profiles / Translate / Translations / Mod Notes / Load Order / Tags / Diagnostic / Steam / Saves）。
- 错误处理偏宽容：路径探测、读写文件大量使用 `Option` + `if let Ok` + `let _ =`。写入类操作返回 `Result<_, String>` 并把中文错误信息直接给前端展示。
- **错误文案目前是中文硬编码在 Rust 里**（如 `"未选择 Steam 用户"`、`"找不到 settings.save 文件"`），会原样弹到英文 UI 上。这是已知的不一致；新增错误文案不要为了统一而重构成 i18n 键值体系（超出当前架构），保持中文即可与现状一致。
- 时间戳统一用 `chrono`；`mods.rs` 里另有一个 `chrono_timestamp()`（毫秒时间戳字符串）用于冲突文件重命名。
- 平台相关代码用 `#[cfg(target_os = "windows")]` + `#[cfg(not(...))]` 成对提供，别只写 Windows 分支。

## 8. 数据落盘位置（领域知识）

### 8.1 应用自身数据 —— `%AppData%\STS2ModManager\`

由 `dirs::config_dir()` 决定，各模块各自拼路径：

| 文件 | 内容 |
|---|---|
| `config.json` | `{ gamePath, smartInstall, steamId }` |
| `load_order.json` | `{ order: [modId, ...] }` |
| `profiles.json` | `{ [档案名]: { snapshot: { [modId]: {version, enabled} }, loadOrder, savedAt } }` |
| `tags.json` | `{ modTags: { [modId]: [标签] }, tagColors: { [标签]: '#rrggbb' } }` |
| `notes.json` | `{ [modId]: 备注文本 }` |
| `translations.json` | `{ [modId]: { name, desc } }`（翻译缓存） |
| `character_names.json` | `{ 'CHARACTER.XXX': '本地化名' }`（从日志推断的 MOD 角色名） |
| `save_backups/` | `auto_backup_<slot>_<ts>.zip`（导入存档前自动备份） |
| `launch.log` | 启动/panic 日志（排查启动失败第一现场） |

### 8.2 游戏数据

| 路径 | 说明 |
|---|---|
| `<游戏目录>/mods/` | 启用的 MOD |
| `<游戏目录>/mods_disabled/` | 禁用的 MOD（**在游戏根目录，不在 mods/ 内**） |
| `<游戏目录>/mods/_disabled/` | 旧版禁用目录，扫描时自动迁移到 `mods_disabled/` |
| `<游戏目录>/release_info.json` | 游戏版本来源（优先于日志解析） |
| `<steamapps>/workshop/content/2868840/<workshopId>/` | 创意工坊 MOD 内容 |
| `%AppData%\SlayTheSpire2\steam\<steamId>\settings.save` | 游戏的 MOD 启用列表 + 加载顺序（JSON） |
| `%AppData%\SlayTheSpire2\steam\<steamId>\profileN[\modded]\` | 存档槽位（`saves/`、`replays/`） |
| `%AppData%\SlayTheSpire2\logs\` | `godot.log` 等游戏日志 |

## 9. 必须知道的坑（改代码前先读）

1. **`npm run build` / `npm run dev` 是坏的，且 README 已过时。**
   - `build` 调用 `webpack --mode production`，但 `webpack.config.js` 不存在 → `Can't resolve './src'` 直接失败。只有 `webpack.tauri.config.js`。
   - `dev` 脚本根本不存在；`package.json` 的 `main: "main.js"`、`build`(electron-builder) 段和 `electron` 系列 devDependencies 都是 Electron 遗留，`main.js`/`preload.js` 已被删除。
   - 同理 `src/index.html` 引用 `../dist/renderer.js`，`src/index.jsx` 也没有 `I18nProvider` —— 都属 Electron 遗留，Tauri 不用它们。**真正的入口是 `src/index-tauri.jsx` + `dist-tauri/index.html`。**
   - 不要把 README 的 "Local Development" 段落当作事实依据，也不要“顺手修好”这些遗留脚本，除非任务明确要求。

2. **`dist-tauri/index.html` 是手写的**，不由任何构建步骤生成；webpack 只产出 `renderer.js`，`build:tauri-fe` 只额外复制 `output.css`。改 title/样式/脚本引用要直接编辑这个文件。

3. **`dist-tauri/*.renderer.js` 的 chunk 已入库**（`318.renderer.js` 是 zh-CN 语言包、`964.renderer.js` 是 en-US，由 `useI18n` 里 `import(\`./${lang}.json\`)` 动态导入产生）。重建前端会重写它们，注意别误删导致 i18n 加载失败；本地重建后也顺手确认这两个文件名没变。

4. **同名 MOD 的三重身份**：本地文件夹版、本地散文件版、创意工坊版可能共享同一个 `id`。
   - `instanceKey` 是磁盘路径，唯一标识一次"安装实例"；`id` 不是。
   - 但 `profiles.snapshot`、`tags.json`、`notes.json`、`translations.json`、`load_order.json` **都按 `id` 存**，所以这些功能在同 id 多实例下天然有歧义。这是已知设计债，涉及这块时不要随手"修"成 `instanceKey`（会破坏用户已有数据）。
   - 写 `settings.save` 时 `build_settings_mod_list` 必须按 `(id, source)` 去重，代码注释解释了原因（去重会把同 id 的创意工坊条目弄丢，而 `scan_workshop_mods` 对"不在列表里的工坊 mod"默认视为启用 → 误启用）。**改这段前先读那段注释。**

5. **创意工坊 MOD 的启停不碰文件系统**，而是改 `settings.save` 的 `mod_settings.mod_list[].is_enabled`。因此：工坊 MOD 无法在管理器里卸载（UI 已禁用按钮），且**所有对 `settings.save` 的写入都要求游戏未运行**，否则会被游戏回写覆盖。写回前会整份 `to_string_pretty` 重写文件，属于有风险操作。

6. **`mods_disabled` 必须在游戏根目录**。早期版本放在 `mods/_disabled`，`migrate_legacy_disabled()` 会在每次扫描时迁移。别把新逻辑写成 `mods/mods_disabled/`。

7. **MOD manifest 的解析规则**（`try_parse_mod`）：
   - 文件夹版：目录下**任意** `.json` 含 `id` + `name` 即认定为 MOD（取第一个命中的）。
   - 散文件版：`<Name>.json` 存在，且同目录下 `<Name>.*` 的兄弟文件归为同一 MOD。
   - `version` 会剥掉开头的 `v`/`V`。
   - `dependencies` 兼容两种写法：`["id1", "id2"]` 与 `[{id, min_version}]`。
   - 同目录多个有效 manifest（工坊里出现过多 MOD 合包）时全部读取，不要假设一个文件夹只对应一个 MOD。

8. **智能安装**（`smart_extract_zip`，可用 `config.smartInstall` 关闭）：zip 根目录直接放 MOD 文件 → 建 `<名称>_v<版本>/`；根目录已是单文件夹 → 直接用；检测到同目录多个 manifest → 回落到 `fallback_extract_zip`。仅支持 `.zip`（`.rar`/`.7z` 会给出明确拒绝提示）。

9. **加载顺序与游戏对不上**：`load_order.json` 是管理器自己的顺序，游戏认的是 `settings.save` 里的 `mod_list`。`App.jsx` 在启动游戏前（若 `sts2-load-order-write-settings !== 'false'`）自动调用 `writeLoadOrderToSettings()` 同步；`ModLoadOrder` 页也有手动开关。

10. **`cargo check` 会有 3 个 `unused variable: state` 警告**，是既有基线，不是本次改动引入的。

11. **`tauri-plugin-single-instance` 在 `Cargo.toml` 里声明了但对 Windows 目标没有生效/未注册**（`lib.rs` 里只注册了 dialog/opener/fs）。属已知遗留。

## 10. 修改检查清单

改完代码，按这个顺序自查：

- [ ] 新增 command 是否三处齐改（`.rs` 实现 / `lib.rs` 注册 / `tauri-api.js` 包装）？
- [ ] 新 UI 文案是否同时加了 `zh-CN.json` 和 `en-US.json`，且键结构一致？
- [ ] 新的配色类是否都补了 `dark:` 变体？
- [ ] 写操作是否返回最新 `mods` 列表，前端是否用 `syncMods(result.mods)`？
- [ ] 破坏性操作是否有确认弹窗并说明后果？
- [ ] 长函数里 `state.game_path.lock()` 是否 `clone()` 后立刻 `drop()`？
- [ ] `cargo check` 无新增错误；`npm run build:tauri-fe` 通过？
- [ ] 是否实机跑过这条路径（扫描 / 启停 / 安装 / 存档 / 工坊）？

## 11. CI 与发布

- [`.github/workflows/build-windows.yml`](.github/workflows/build-windows.yml)：`push` 到 `main`/`master` 或手动触发 → 构建并上传两个 artifact（便携 exe、NSIS 安装包），30 天保留。
- [`.github/workflows/build.yml`](.github/workflows/build.yml)：`push` 标签 `v*` 或手动触发 → 构建 + 调用 `python scripts/ci/gh_publish.py --repo-root <root> tag-release` 创建/更新 GitHub Release。
- `gh_publish.py` 的更新日志来源（依次拼接）：注解 tag 的 message → `上一版本..本 tag` 的 commit 主题列表 → GitHub 官方 PR 自动生成笔记。因为本项目**直接往 main 推 commit 不走 PR**，commit 主题是更新日志的主体，所以 **commit message 要写得像给人看的说明**（现有风格：`feat: ...` / `fix: ...` / `ci: ...`，中文描述可以）。
- 发布流程：改 `src-tauri/tauri.conf.json` 的 `version` → 提交 → `git tag v1.x.y` → push tag。
- 仓库没有 `LICENSE` 文件（README 写的是 MIT），也没有 `CONTRIBUTING`，无需遵循额外流程。

### 11.1 实测发布习惯（v1.5.2 / v1.5.3 实操）

- **拆两个 commit**：功能改动一个 commit，版本号单独一个 commit，标题就是版本号本身（`1.5.2` / `1.5.3`，不带 `chore:` 前缀）。历史上的 `7176518`、`63e8c35` 都是这种单行版本 commit。
- **tag 用轻量 tag**（`git tag v1.x.y`，不加 `-a`）。除 `v1.1.0` 外全部是 lightweight tag，于是 `gh_publish.py` 读到的 tag 注解为空，**Release 正文完全由 commit 主题列表决定** —— 更加印证「commit message 要写成人话」。
- **顺序**：`git push origin main` → `git tag v1.x.y` → `git push origin v1.x.y`（单独推 tag 才会触发 `build.yml`）。
- **耗时**：Windows runner 全流程约 9~10 分钟（v1.5.2：10:48:12 触发 → 10:56:56 发布）。推完 tag 不必守着，`Build and Release` 与 `Build Windows` 各跑一个。
- **本机没有 `gh` CLI**，看流水线只能用 GitHub REST API + `curl`：
  ```bash
  curl -sS --ssl-no-revoke -m 40 \
    "https://api.github.com/repos/DZX66/sts2-mod-manager/actions/runs?per_page=5"
  curl -sS --ssl-no-revoke -m 40 \
    "https://api.github.com/repos/DZX66/sts2-mod-manager/actions/runs/<run_id>/jobs"
  ```
  必须带 `--ssl-no-revoke`，否则 Windows schannel 会报 `CRYPT_E_NO_REVOCATION_CHECK`（`HTTP 000`）。落盘的临时 `run.json` 之类用完即删，别混进工作区。
- **`git push` 偶发 `Recv failure: Connection was reset`**：不是代理/配置问题（`git ls-remote` 正常），直接重试一次即可。
- 发版前确认 `git status` 干净；`dist-tauri/` 的构建产物（`renderer.js`、`318/964.renderer.js`、`output.css`、`src/output.css`）是入库的，重新构建后必须一起提交。


## 12. 语言习惯

- 用户是中文使用者，**用中文回复**。
- 代码注释、错误文案、commit message 目前以中文为主，保持一致；标识符、API 名、类型名保持英文。
- 文档：`README.md`（英文）与 `docs/README.zh-CN.md`（中文）成对维护，改特性时两边都要更新。
