# Tasks: fix-i18n-test-assertions

> 将测试断言与 `00ca49f` 中文化提交后的实际输出对齐，消除约 143 个 i18n 遗留失败。
> 修复前用 `git show 00ca49f -- <对应 src 文件>` 提取英→中对照。
> 不处理 root 权限相关失败（D 类）。

## 第一批：高密度文件（前 5 个占 85 个失败）

- [ ] **1.1** 修复 `test/core/update.test.ts`（25 个失败）—— 更新命令输出断言（`Updated:` → `正在更新` 等）
- [ ] **1.2** 修复 `test/commands/artifact-workflow.test.ts`（23 个失败）—— 变更创建/状态/帮助文案断言
- [ ] **1.3** 修复 `test/commands/config-profile.test.ts`（14 个失败）—— picker 文案、diff 格式化（`workflows: added/removed` → `工作流: 新增/移除`）
- [ ] **1.4** 修复 `test/core/archive.test.ts`（12 个失败）
- [ ] **1.5** 修复 `test/commands/workspace.interactive.test.ts`（11 个失败）—— picker message 文案

## 第二批：validation 系列（含语义变化，需核对关键词集合）

- [ ] **2.1** 修复 `test/core/validation.test.ts`（10 个失败）—— 核对 `src/core/validation/constants.ts` 的关键词集合
- [ ] **2.2** 修复 `test/core/validation.enriched-messages.test.ts`（3 个失败）

## 第三批：中等密度文件

- [ ] **3.1** 修复 `test/commands/completion.test.ts`（8 个失败）—— Shell 支持错误文案
- [ ] **3.2** 修复 `test/commands/workspace.test.ts`（5 个失败）
- [ ] **3.3** 修复 `test/cli-e2e/basic.test.ts`（5 个失败，含 zcode 工具列表补充）

## 第四批：小文件（各 2-4 个）

- [ ] **4.1** 修复 `test/commands/feedback.test.ts`（4 个失败）
- [ ] **4.2** 修复 `test/core/list.test.ts`（3 个失败，`toEqual` 精确数组）
- [ ] **4.3** 修复 `test/commands/spec.test.ts`（3 个失败）
- [ ] **4.4** 修复 `test/commands/show.test.ts`（3 个失败）
- [ ] **4.5** 修复 `test/commands/validate.test.ts`（2 个失败）
- [ ] **4.6** 修复 `test/commands/change-initiative-link.test.ts`（2 个失败）
- [ ] **4.7** 修复剩余各 1 个失败的小文件

## 验证

- [ ] **5.1** 运行 `pnpm test`，确认 i18n 相关失败归零（root 权限失败除外）
- [ ] **5.2** 记录仍存在的 D 类权限失败，作为已知问题标注
