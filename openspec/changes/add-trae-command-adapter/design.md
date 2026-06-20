# Design: add-trae-command-adapter

## Context

OpenSpec CLI 的命令生成采用 adapter 模式：每个 agent 一个 adapter 文件，通过 `CommandAdapterRegistry` 注册。本 change 为 **Trae 与 ZCode** 两个 agent 补齐缺失的 command adapter：
- Trae 目前只有 skill 生成支持（`skillsDir: '.trae'`），缺少 command adapter，导致 `openspec init` 选择 Trae 时不生成 `.trae/commands/` 下的斜杠命令文件。
- ZCode CLI（OpenSpec-Cn fork 的运行时）在 `~/.zcode/commands/` 下使用 `opsx-<id>.md` 命令文件，但 `AI_TOOLS` 列表未收录 ZCode，`openspec init` 无法选择，命令文件需手工维护。

## 参考实现

[adapters/codebuddy.ts](file:///www/wwwroot/vscode-extensions/OpenSpec-Cn/src/core/command-generation/adapters/codebuddy.ts) 是最佳参考——路径模式 `.codebuddy/commands/opsx/<id>.md` 与 Trae 的 `.trae/commands/opsx/<id>.md` 完全一致，仅 toolId 和路径前缀不同。

## Trae 命令格式（已实测验证）

- **路径**：`.trae/commands/opsx/<id>.md`（2 层嵌套，在 Trae 的 3 层限制内）
- **frontmatter**：`name`、`description`（英文 key，与 `.trae/skills/<name>/SKILL.md` 一致）
- **正文**：指令内容
- **实测结论**：纯文本指令（无 frontmatter）也能触发，但为保持与其他 adapter 一致，仍生成 frontmatter

## 技术方案

### 1. 新增 `src/core/command-generation/adapters/trae.ts`

```typescript
/**
 * Trae Command Adapter
 *
 * Formats commands for Trae following its command specification.
 * Docs: https://docs.trae.cn/ (命令功能)
 */

import path from 'path';
import type { CommandContent, ToolCommandAdapter } from '../types.js';

/**
 * Trae adapter for command generation.
 * File path: .trae/commands/opsx/<id>.md
 * Frontmatter: name, description
 */
export const traeAdapter: ToolCommandAdapter = {
  toolId: 'trae',

  getFilePath(commandId: string): string {
    return path.join('.trae', 'commands', 'opsx', `${commandId}.md`);
  },

  formatFile(content: CommandContent): string {
    return `---
name: ${content.name}
description: "${content.description}"
---

${content.body}
`;
  },
};
```

### 2. 在 `adapters/index.ts` 导出

```typescript
export { traeAdapter } from './trae.js';
```

### 3. 在 `registry.ts` 注册

```typescript
import { traeAdapter } from './adapters/trae.js';
// ...
static {
  // ... existing registrations
  CommandAdapterRegistry.register(traeAdapter);
}
```

### 4. 更新 `config.ts` 的 Trae 配置

当前：
```typescript
{ name: 'Trae', value: 'trae', available: true, successLabel: 'Trae', skillsDir: '.trae' }
```

改为：
```typescript
{ name: 'Trae', value: 'trae', available: true, successLabel: 'Trae', skillsDir: '.trae', detectionPaths: ['.trae/commands', '.trae/skills'] }
```

`detectionPaths` 用于 `openspec detect` 命令识别工作区已配置的 agent。

### 5. 更新文档 `docs/supported-tools.md`

在 Trae 行的命令支持列从 `—` 改为 `✓`，标注命令路径 `.trae/commands/opsx/`。

### 6. 新增测试

在 `test/core/command-generation/adapters.test.ts`（或对应测试文件）添加：

```typescript
describe('trae adapter', () => {
  it('returns correct file path', () => {
    expect(traeAdapter.getFilePath('propose')).toBe(
      path.join('.trae', 'commands', 'opsx', 'propose.md')
    );
  });

  it('formats file with frontmatter', () => {
    const content: CommandContent = {
      name: 'openspec-propose',
      description: 'Propose a new change',
      category: 'openspec',
      tags: ['openspec'],
      body: 'Propose instructions...',
    };
    const result = traeAdapter.formatFile(content);
    expect(result).toContain('name: openspec-propose');
    expect(result).toContain('description: "Propose a new change"');
    expect(result).toContain('Propose instructions...');
  });

  it('is registered in CommandAdapterRegistry', () => {
    expect(CommandAdapterRegistry.has('trae')).toBe(true);
    expect(CommandAdapterRegistry.get('trae')).toBe(traeAdapter);
  });
});
```

## 验证步骤

1. `pnpm test` 全部通过
2. 在 sample-workspace 运行 `openspec init --force`，选择 Trae，确认生成 `.trae/commands/opsx/` 下的命令文件
3. 在 Trae IDE 中输入 `/opsx:propose`，确认斜杠命令可触发

## 风险

- **Trae frontmatter 字段未完全确定**：文档表格用中文标签（名称/描述），但 skill 文件用英文 key（name/description）。本方案用英文 key，需实测验证。若 Trae 不识别 frontmatter，命令仍能触发（已验证纯文本可触发），frontmatter 仅作元信息。
- **description 引号转义**：参考 codebuddy 用双引号包裹 description，避免 YAML 特殊字符问题。

---

## ZCode 方案（与 Trae 并列）

### 参考实现

[adapters/auggie.ts](file:///www/wwwroot/vscode-extensions/OpenSpec-Cn/src/core/command-generation/adapters/auggie.ts) 是最佳参考——ZCode 命令路径 `.zcode/commands/opsx-<id>.md` 与 auggie 的 `.augment/commands/opsx-<id>.md` 完全一致（扁平结构 + `opsx-` 前缀），frontmatter 也同为 `description` + `argument-hint`。

### ZCode 命令格式（依据既有文件实测）

`~/.zcode/commands/` 下已有 11 个 `opsx-*.md` 文件（如 `opsx-archive.md`、`opsx-apply.md`），以及说明文件 `commands例子.md`：
- **路径**：`.zcode/commands/opsx-<id>.md`（扁平结构，文件名带 `opsx-` 前缀）
- **frontmatter**：`description`（必填）、`argument-hint`（可选）
- **正文**：指令内容

### 1. 新增 `src/core/command-generation/adapters/zcode.ts`

```typescript
/**
 * ZCode Command Adapter
 *
 * Formats commands for ZCode CLI following its command specification.
 * ZCode 在 .zcode/commands/ 下使用扁平的 opsx-<id>.md 文件。
 */

import path from 'path';
import type { CommandContent, ToolCommandAdapter } from '../types.js';

/**
 * ZCode adapter for command generation.
 * File path: .zcode/commands/opsx-<id>.md
 * Frontmatter: description, argument-hint
 */
export const zcodeAdapter: ToolCommandAdapter = {
  toolId: 'zcode',

  getFilePath(commandId: string): string {
    return path.join('.zcode', 'commands', `opsx-${commandId}.md`);
  },

  formatFile(content: CommandContent): string {
    return `---
description: ${content.description}
argument-hint: command arguments
---

${content.body}
`;
  },
};
```

### 2. 导出与注册（与 Trae 同模式）

在 `adapters/index.ts` 添加 `export { zcodeAdapter } from './zcode.js';`；在 `registry.ts` import 并在 `static {}` 块末尾 `CommandAdapterRegistry.register(zcodeAdapter);`。

### 3. 更新 `config.ts` 的 AI_TOOLS

Trae 之后新增一行（ZCode 与 Trae、Windsurf 同为 IDE/CLI 类工具，放在一起便于查找）：

```typescript
{ name: 'ZCode', value: 'zcode', available: true, successLabel: 'ZCode', skillsDir: '.zcode', detectionPaths: ['.zcode/commands', '.zcode/skills'] },
```

### 4. 更新文档 `docs/supported-tools.md`

- 新增 ZCode 行：`| ZCode (\`zcode\`) | \`.zcode/skills/openspec-*/SKILL.md\` | \`.zcode/commands/opsx-<id>.md\` |`
- 在 `--tools` 的 ID 列表中追加 `zcode`

### 5. 新增测试

```typescript
describe('zcodeAdapter', () => {
  it('returns correct file path', () => {
    expect(zcodeAdapter.getFilePath('explore')).toBe(
      path.join('.zcode', 'commands', 'opsx-explore.md')
    );
  });

  it('formats file with description and argument-hint', () => {
    const result = zcodeAdapter.formatFile(sampleContent);
    expect(result).toContain('description: Enter explore mode for thinking');
    expect(result).toContain('argument-hint: command arguments');
    expect(result).toContain('This is the command body.');
  });
});
```
