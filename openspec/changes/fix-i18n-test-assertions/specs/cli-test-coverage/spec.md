## ADDED Requirements

### Requirement: 测试断言与中文化输出一致

`pnpm test` 中所有断言用户可见输出的测试 SHALL 与 `00ca49f` 提交后的中文实际输出保持一致。不再残留期望英文输出的断言。

#### Scenario: 更新命令输出断言

- **WHEN** 运行 `test/core/update.test.ts` 中关于工具更新的断言
- **THEN** 断言 SHALL 匹配中文输出（如 `正在更新` 而非 `Updated:`）
- **AND** 对于含动态内容的输出（工具名、版本号、路径），SHALL 使用 `stringContaining` 或正则匹配关键词，而非精确字符串

#### Scenario: 变更工作流输出断言

- **WHEN** 运行 `test/commands/artifact-workflow.test.ts` 中的变更创建/状态断言
- **THEN** 断言 SHALL 匹配中文输出（如 `已创建变更` 而非 `Created change`）

#### Scenario: 校验关键词集合断言

- **WHEN** 运行 `test/core/validation.test.ts` 中关于 SHALL/MUST 关键词的断言
- **THEN** 断言 SHALL 反映中文化后的关键词集合（`SHALL`、`MUST`、`必须`、`应当` 均被接受）
- **AND** 错误提示文案 SHALL 匹配中文版本（如 `需求必须包含 SHALL、MUST、必须 或 应当`）

#### Scenario: e2e 真实子进程输出断言

- **WHEN** 运行 `test/cli-e2e/basic.test.ts` 这类调用真实 CLI 子进程的测试
- **THEN** 断言 SHALL 匹配子进程的中文 stdout 输出
- **AND** 工具 ID 列表断言 SHALL 包含 fork 新增的 `zcode`（如适用）

#### Scenario: root 权限失败不在本范围

- **WHEN** 测试因以 root 用户运行而绕过文件权限检查导致失败（如 `*-installer.test.ts`、`file-system.test.ts`）
- **THEN** 这些失败 SHALL 不视为 i18n 回归，不在本 change 处理范围内
- **AND** 本 change 的验证标准 SHALL 以非 root 环境或排除权限测试后的失败数为基准
