## ADDED Requirements

### Requirement: Trae command adapter

系统 SHALL 提供 Trae 的命令 adapter，遵循 `ToolCommandAdapter` 接口契约，使 `openspec init` 选择 Trae 时生成项目级斜杠命令文件。

#### Scenario: Trae 命令文件路径

- **WHEN** 为 Trae 生成 ID 为 `<id>` 的命令
- **THEN** adapter 的 `getFilePath('<id>')` SHALL 返回路径 `.trae/commands/opsx/<id>.md`
- **AND** 该路径 MUST 嵌套深度不超过 3 层（Trae 的目录嵌套限制）

#### Scenario: Trae frontmatter 格式

- **WHEN** 调用 adapter 的 `formatFile(content)` 格式化命令内容
- **THEN** 输出 SHALL 以 YAML frontmatter 开头，包含 `name` 与 `description` 字段（英文 key）
- **AND** `description` 值 SHALL 用双引号包裹以避免 YAML 特殊字符问题
- **AND** frontmatter 之后 SHALL 跟随命令正文（`content.body`）

#### Scenario: Trae adapter 注册

- **WHEN** 系统初始化命令生成注册表
- **THEN** `CommandAdapterRegistry.has('trae')` SHALL 返回 `true`
- **AND** `CommandAdapterRegistry.get('trae')` SHALL 返回 Trae adapter 实例
- **AND** `CommandAdapterRegistry.getAll()` SHALL 包含 `toolId` 为 `'trae'` 的 adapter

#### Scenario: Trae 命令文件路径的跨平台处理

- **WHEN** 在 Windows 或 Linux/macOS 工作区为 Trae 生成命令文件
- **THEN** 系统 SHALL 使用 `path.join()`（或等价的跨平台路径拼接）构造路径，不得硬编码路径分隔符
- **AND** 在 Windows 上路径分隔符 MUST 正确呈现，而不影响文件写入位置

#### Scenario: Trae 与 skill 生成共存

- **WHEN** 用户在 `openspec init` 中选择 Trae
- **THEN** 系统 SHALL 同时生成 `.trae/skills/`（既有 skill 支持）与 `.trae/commands/opsx/<id>.md`（新增命令支持）
- **AND** Trae 配置项的 `detectionPaths` SHALL 包含 `.trae/commands` 与 `.trae/skills`，以便 `openspec detect` 识别工作区已配置 Trae

### Requirement: ZCode command adapter

系统 SHALL 提供 ZCode CLI 的命令 adapter，遵循 `ToolCommandAdapter` 接口契约，使 `openspec init` 选择 ZCode 时生成项目级斜杠命令文件。ZCode 命令路径与格式依据 `~/.zcode/commands/` 下既有命令文件（如 `opsx-archive.md`）及 `commands例子.md` 确定。

#### Scenario: ZCode 命令文件路径

- **WHEN** 为 ZCode 生成 ID 为 `<id>` 的命令
- **THEN** adapter 的 `getFilePath('<id>')` SHALL 返回路径 `.zcode/commands/opsx-<id>.md`
- **AND** 文件名 SHALL 使用 `opsx-` 前缀加命令 ID（扁平结构，与 auggie/bob/factory 一致）

#### Scenario: ZCode frontmatter 格式

- **WHEN** 调用 adapter 的 `formatFile(content)` 格式化命令内容
- **THEN** 输出 SHALL 以 YAML frontmatter 开头，包含 `description` 与 `argument-hint` 字段（英文 key）
- **AND** frontmatter 之后 SHALL 跟随命令正文（`content.body`）

#### Scenario: ZCode adapter 注册

- **WHEN** 系统初始化命令生成注册表
- **THEN** `CommandAdapterRegistry.has('zcode')` SHALL 返回 `true`
- **AND** `CommandAdapterRegistry.get('zcode')` SHALL 返回 ZCode adapter 实例

#### Scenario: ZCode 命令文件路径的跨平台处理

- **WHEN** 在 Windows 或 Linux/macOS 工作区为 ZCode 生成命令文件
- **THEN** 系统 SHALL 使用 `path.join()`（或等价的跨平台路径拼接）构造路径，不得硬编码路径分隔符
- **AND** 在 Windows 上路径分隔符 MUST 正确呈现，而不影响文件写入位置

#### Scenario: ZCode 作为可选工具出现在 init 列表

- **WHEN** 用户运行 `openspec init` 查看 AI 工具选项
- **THEN** ZCode SHALL 作为 `available: true` 的选项出现在 `AI_TOOLS` 列表中
- **AND** ZCode 配置项的 `detectionPaths` SHALL 包含 `.zcode/commands` 与 `.zcode/skills`，以便 `openspec detect` 识别工作区已配置 ZCode
