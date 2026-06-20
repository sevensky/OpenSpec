# Proposal: add-trae-command-adapter

## Why

OpenSpec CLI 已支持 26 个 agent 的命令生成（claude、codebuddy、cursor 等），但 **Trae 只有 skill adapter，没有 command adapter**。`openspec init` 选择 Trae 时只生成 `.trae/skills/`，不生成 `.trae/commands/`，导致 Trae 用户无法使用 `/opsx:propose`、`/opsx:apply`、`/opsx:archive` 等斜杠命令。

经实测验证，Trae 支持项目级命令：
- 路径：`.trae/commands/`（支持最多 3 层嵌套）
- 格式：`.md` 文件，frontmatter + 指令正文
- 中文命令名亦可用（但 OpenSpec 命令 ID 保持英文）

此外，**ZCode CLI（OpenSpec-Cn fork 所在的运行时）同样缺少 command adapter**。ZCode 已在 `~/.zcode/commands/` 下使用 `opsx-<id>.md` 命令文件（frontmatter 含 `description`、可选 `argument-hint`），但 `openspec init` 不支持选择 ZCode，无法自动生成这些命令文件，需手工维护。

本 change 为 **Trae 与 ZCode 两个 agent** 新增 command adapter，与 codebuddy/claude/auggie 对齐。ZCode 与 Trae 一并纳入此 change（同属"补齐缺失的 command adapter"主题）。

## What Changes

### Trae

- 新增 `src/core/command-generation/adapters/trae.ts`，路径 `.trae/commands/opsx/<id>.md`
- 在 `src/core/command-generation/adapters/index.ts` 导出 trae adapter
- 在 `src/core/command-generation/registry.ts` 注册 trae adapter
- 更新 `src/core/config.ts` 的 Trae 配置，补充 `detectionPaths: ['.trae/commands', '.trae/skills']`
- 更新 `docs/supported-tools.md` 文档表格（Trae 行命令列改为 `✓`）

### ZCode

- 新增 `src/core/command-generation/adapters/zcode.ts`，路径 `.zcode/commands/opsx-<id>.md`
- 在 `src/core/command-generation/adapters/index.ts` 导出 zcode adapter
- 在 `src/core/command-generation/registry.ts` 注册 zcode adapter
- 在 `src/core/config.ts` 的 `AI_TOOLS` 新增 ZCode 配置项（`value: 'zcode'`，`skillsDir: '.zcode'`，`detectionPaths: ['.zcode/commands', '.zcode/skills']`）
- 更新 `docs/supported-tools.md` 文档表格新增 ZCode 行

### 测试

- 在 `test/core/command-generation/adapters.test.ts` 覆盖 trae 与 zcode 两个 adapter

## Capabilities

### New Capabilities

- `command-generation`: Trae 与 ZCode agent 支持命令文件生成
  - Trae：路径 `.trae/commands/opsx/<id>.md`，frontmatter 含 `name`、`description`
  - ZCode：路径 `.zcode/commands/opsx-<id>.md`，frontmatter 含 `description`、`argument-hint`

### Modified Capabilities

_None._

## Impact

- 新增 `src/core/command-generation/adapters/trae.ts`
- 新增 `src/core/command-generation/adapters/zcode.ts`
- 修改 `src/core/command-generation/adapters/index.ts`
- 修改 `src/core/command-generation/registry.ts`
- 修改 `src/core/config.ts`（Trae 补充 detectionPaths；新增 ZCode 配置项）
- 修改 `docs/supported-tools.md`
- 修改 `test/core/command-generation/adapters.test.ts`

## Frontmatter 格式

### Trae

参考 Trae 官方文档及现有 skill 文件（`.trae/skills/<name>/SKILL.md` 用英文 key），Trae 命令 frontmatter 采用：

```yaml
---
name: <command name>
description: <command description>
---

<command body>
```

与 codebuddy adapter 格式一致（去掉 `argument-hint`，因 Trae 文档未提及该字段）。

### ZCode

参考 `~/.zcode/commands/` 下既有命令文件（如 `opsx-archive.md`）及 `commands例子.md`，ZCode 命令 frontmatter 采用：

```yaml
---
description: <command description>
argument-hint: <参数提示可选>
---

<command body>
```

与 auggie/bob/factory adapter 格式一致（`argument-hint` 为 ZCode 支持的字段）。
