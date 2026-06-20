# Tasks: add-trae-command-adapter

> 为 OpenSpec CLI 新增 Trae 与 ZCode 两个 agent 的命令 adapter，使 `openspec init` 选择对应工具时生成各自的斜杠命令文件。
> - Trae：`.trae/commands/opsx/<id>.md`
> - ZCode：`.zcode/commands/opsx-<id>.md`
>
> 仓库：`/www/wwwroot/vscode-extensions/OpenSpec-Cn`

## 第一部分：Trae adapter

### 1. 新增 Trae adapter 文件

- [ ] **1.1** 创建 `src/core/command-generation/adapters/trae.ts`
  - `toolId: 'trae'`
  - `getFilePath(id)` 返回 `.trae/commands/opsx/${id}.md`
  - `formatFile(content)` 生成 frontmatter（`name`、`description`）+ body
  - 参考 [codebuddy.ts](file:///www/wwwroot/vscode-extensions/OpenSpec-Cn/src/core/command-generation/adapters/codebuddy.ts)

### 2. 注册 Trae adapter

- [ ] **2.1** 在 `src/core/command-generation/adapters/index.ts` 添加 `export { traeAdapter } from './trae.js';`
- [ ] **2.2** 在 `src/core/command-generation/registry.ts` 的 import 区添加 `import { traeAdapter } from './adapters/trae.js';`
- [ ] **2.3** 在 `registry.ts` 的 `static { }` 块末尾添加 `CommandAdapterRegistry.register(traeAdapter);`

### 3. 更新 config.ts（Trae）

- [ ] **3.1** 在 `src/core/config.ts` 的 Trae 配置项补充 `detectionPaths: ['.trae/commands', '.trae/skills']`

## 第二部分：ZCode adapter

### 4. 新增 ZCode adapter 文件

- [ ] **4.1** 创建 `src/core/command-generation/adapters/zcode.ts`
  - `toolId: 'zcode'`
  - `getFilePath(id)` 返回 `.zcode/commands/opsx-${id}.md`（扁平结构，`opsx-` 前缀）
  - `formatFile(content)` 生成 frontmatter（`description`、`argument-hint`）+ body
  - 参考 [auggie.ts](file:///www/wwwroot/vscode-extensions/OpenSpec-Cn/src/core/command-generation/adapters/auggie.ts)

### 5. 注册 ZCode adapter

- [ ] **5.1** 在 `src/core/command-generation/adapters/index.ts` 添加 `export { zcodeAdapter } from './zcode.js';`
- [ ] **5.2** 在 `src/core/command-generation/registry.ts` 的 import 区添加 `import { zcodeAdapter } from './adapters/zcode.js';`
- [ ] **5.3** 在 `registry.ts` 的 `static { }` 块末尾添加 `CommandAdapterRegistry.register(zcodeAdapter);`

### 6. 更新 config.ts（ZCode）

- [ ] **6.1** 在 `src/core/config.ts` 的 `AI_TOOLS` 新增 ZCode 配置项（Trae 之后）：
  - `{ name: 'ZCode', value: 'zcode', available: true, successLabel: 'ZCode', skillsDir: '.zcode', detectionPaths: ['.zcode/commands', '.zcode/skills'] }`

## 第三部分：文档与测试

### 7. 更新文档

- [ ] **7.1** 更新 `docs/supported-tools.md`：
  - Trae 行的命令支持列改为 `.trae/commands/opsx/<id>.md`
  - 新增 ZCode 行：`| ZCode (\`zcode\`) | \`.zcode/skills/openspec-*/SKILL.md\` | \`.zcode/commands/opsx-<id>.md\` |`
  - 在 `--tools` 的 ID 列表追加 `zcode`

### 8. 新增测试

- [ ] **8.1** 在 `test/core/command-generation/adapters.test.ts` 添加 **trae** adapter 测试用例：
  - `getFilePath('propose')` 返回正确路径
  - `formatFile(content)` 包含 name、description、body
  - `CommandAdapterRegistry.has('trae')` 为 true
  - `CommandAdapterRegistry.get('trae')` 返回 traeAdapter
- [ ] **8.2** 在同文件添加 **zcode** adapter 测试用例：
  - `getFilePath('explore')` 返回 `path.join('.zcode', 'commands', 'opsx-explore.md')`
  - `formatFile(content)` 包含 description、argument-hint、body
  - `CommandAdapterRegistry.has('zcode')` 为 true
  - `CommandAdapterRegistry.get('zcode')` 返回 zcodeAdapter

### 9. 验证

- [ ] **9.1** 运行 `pnpm test`，全部通过
- [ ] **9.2** 在 sample-workspace 运行 `openspec init --force`，选择 Trae，确认生成 `.trae/commands/opsx/` 下的命令文件（propose.md、apply.md、archive.md 等）
- [ ] **9.3** 在 Trae IDE 中输入 `/opsx:propose`，确认斜杠命令可触发
- [ ] **9.4** 在 sample-workspace 运行 `openspec init --force`，选择 ZCode，确认生成 `.zcode/commands/opsx-*.md` 下的命令文件
