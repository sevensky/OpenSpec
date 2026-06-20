# Proposal: fix-i18n-test-assertions

## Why

之前的 i18n 中文化提交（`00ca49f "i18n: Chinese translation of all user-facing strings"`）把所有 CLI 用户可见输出硬编码改成了中文，但**没有同步更新测试断言**。大量测试仍期望英文输出（如 `expect(...).toContain("Updated: Claude Code")`），导致约 **143 个测试失败**。这批失败掩盖了真实的回归，每次跑 `pnpm test` 都产生大量噪音，使开发者难以发现新引入的问题。

## What Changes

- 逐文件将测试中的英文输出断言更新为对应的中文文案（与 `00ca49f` 的实际中文输出对齐）
- 对于动态拼接的中文串（含路径、工具名、列表），改用更宽松的匹配（`stringContaining` 关键词 / 正则），降低断言脆性
- `validation` 系列断言需额外核对关键词集合变化（`必须/应当` 已并入 `SHALL/MUST` 体系）
- **不处理**与 i18n 无关的 root 权限失败（`file-system.test.ts`、`*-installer.test.ts` 约 10 个），这些归为独立的权限测试问题

## Capabilities

### New Capabilities

- `cli-test-coverage`: CLI 测试断言与实际（中文）输出保持一致，确保 `pnpm test` 在 i18n 中文化后能真实反映代码健康度

### Modified Capabilities

_None._

## Impact

按失败密度排序的重点测试文件（前 5 个占 85 个失败）：

- `test/core/update.test.ts`（25 个失败）
- `test/commands/artifact-workflow.test.ts`（23 个失败）
- `test/commands/config-profile.test.ts`（14 个失败）
- `test/core/archive.test.ts`（12 个失败）
- `test/commands/workspace.interactive.test.ts`（11 个失败）
- `test/core/validation.test.ts`（10 个失败，含语义变化）
- `test/commands/completion.test.ts`（8 个失败）
- `test/commands/workspace.test.ts`（5 个失败）
- `test/cli-e2e/basic.test.ts`（5 个失败，e2e 真实子进程）
- `test/commands/feedback.test.ts`（4 个失败）
- `test/core/validation.enriched-messages.test.ts`（3 个失败）
- `test/core/list.test.ts`（3 个失败）
- `test/commands/spec.test.ts`、`test/commands/show.test.ts`、`test/commands/validate.test.ts`、`test/commands/change-initiative-link.test.ts`（各 2-3 个）
- 其余约 10 个文件各 1 个失败

## 修复策略

1. **优先大文件**：前 5 个文件性价比最高，逐个用 `git show 00ca49f -- <对应src文件>` 提取英→中对照
2. **validation 单独处理**：核对 `src/core/validation/constants.ts` 的关键词集合，确认中文文案与语义
3. **e2e 改关键词匹配**：`cli-e2e/basic.test.ts` 改为断言中文关键词；其中 init 工具列表需补 `zcode`（fork 新增）
4. **不动 D 类**：root 权限失败单独记录，不在本 change 范围
