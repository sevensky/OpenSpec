<p align="center">
  <a href="https://github.com/sevensky/OpenSpec">
    <picture>
      <source srcset="assets/openspec_bg.png">
      <img src="assets/openspec_bg.png" alt="OpenSpec logo">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://github.com/sevensky/OpenSpec/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sevensky/OpenSpec/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://www.npmjs.com/package/@superkou/openspec"><img alt="npm version" src="https://img.shields.io/npm/v/@superkou/openspec?style=flat-square" /></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" /></a>
</p>

> [!IMPORTANT]
> **🇨🇳 本项目是 [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) 的中文化 Fork**
>
> 所有用户可见的界面文字已翻译为中文，包括 CLI 命令、错误提示、交互提示和模板文档。
> 发布在 npm 上为 [`@superkou/openspec`](https://www.npmjs.com/package/@superkou/openspec)，CLI 命令依然是 `openspec`。
>
> 会持续同步上游更新。欢迎提交 Issue 和 PR！

<p align="center">
  <sub>上游 · <a href="https://github.com/Fission-AI/OpenSpec">Fission-AI/OpenSpec</a></sub>
</p>

<details>
<summary><strong>最受欢迎的规格框架</strong></summary>

[![Stars](https://img.shields.io/github/stars/sevensky/OpenSpec?style=flat-square&label=Stars)](https://github.com/sevensky/OpenSpec/stargazers)
[![Downloads](https://img.shields.io/npm/dm/@superkou/openspec?style=flat-square&label=Downloads/mo)](https://www.npmjs.com/package/@superkou/openspec)

</details>
<p></p>

核心理念：

```text
→ 灵活，不僵化
→ 迭代，非瀑布
→ 简单，不复杂
→ 适配既有项目，不仅限于新项目
→ 从个人项目到企业级都可扩展
```

> [!TIP]
> **新工作流已可用！** 我们基于新的制品引导工作流重构了 OpenSpec。
>
> 运行 `/opsx:propose "你的想法"` 开始使用。→ [了解更多](docs/opsx.md)

<p align="center">
  关注 <a href="https://x.com/0xTab">@0xTab on X</a> 获取更新 · 加入 <a href="https://discord.gg/YctCnvvshC">OpenSpec Discord</a> 寻求帮助
</p>

<!-- TODO: Add GIF demo of /opsx:propose → /opsx:archive workflow -->

## 效果预览

```text
你: /opsx:propose 添加暗色模式
AI:  已创建 openspec/changes/add-dark-mode/
     ✓ proposal.md — 为何要做、变更内容
     ✓ specs/       — 需求和场景
     ✓ design.md    — 技术方案
     ✓ tasks.md     — 实现清单
     准备就绪，开始实现！

你: /opsx:apply
AI:  正在执行任务...
     ✓ 1.1 添加主题 Context Provider
     ✓ 1.2 创建切换组件
     ✓ 2.1 添加 CSS 变量
     ✓ 2.2 接入 localStorage
     所有任务完成！

你: /opsx:archive
AI:  已归档到 openspec/changes/archive/2025-01-23-添加暗色模式/
     规格已更新。准备进行下一个功能。
```

<details>
<summary><strong>OpenSpec 仪表盘</strong></summary>

<p align="center">
  <img src="assets/openspec_dashboard.png" alt="OpenSpec 仪表盘预览" width="90%">
</p>

</details>

## 快速开始

**需要 Node.js 20.19.0 或更高版本。**

全局安装 OpenSpec：

```bash
npm install -g @superkou/openspec@latest
```

然后进入你的项目目录并初始化：

```bash
cd your-project
openspec init
```

现在告诉你的 AI：`/opsx:propose <你想构建的功能>`

如果想使用扩展工作流（`/opsx:new`、`/opsx:continue`、`/opsx:ff`、`/opsx:verify`、`/opsx:bulk-archive`、`/opsx:onboard`），运行 `openspec config profile` 选择，然后用 `openspec update` 应用。

> [!NOTE]
> 不确定你的工具是否受支持？[查看完整列表](docs/supported-tools.md) — 我们支持 25+ 种工具且持续增加。
>
> 也支持 pnpm、yarn、bun 和 nix。[查看安装选项](docs/installation.md)。

## 文档

→ **[入门指南](docs/getting-started.md)**：第一步<br>
→ **[工作流](docs/workflows.md)**：组合与模式<br>
→ **[命令](docs/commands.md)**：斜杠命令与技能<br>
→ **[CLI](docs/cli.md)**：终端参考<br>
→ **[支持的工���](docs/supported-tools.md)**：工具集成与安装路径<br>
→ **[概念](docs/concepts.md)**：整体架构<br>
→ **[多语言](docs/multi-language.md)**：多语言支持<br>
→ **[自定义](docs/customization.md)**：按需定制

## 社区 Schema

第三方 Schema 包通过独立仓库分发——提供有观点的工���流，将 OpenSpec 与其他工具集成，类似于 [github/spec-kit 的社区扩展目录](https://github.com/github/spec-kit/tree/main/extensions) 的处理方式。

→ **[浏览目录](docs/customization.md#community-schemas)** 查看自定义文档。

## 为什么选择 OpenSpec？

AI 编程助手功能强大，但当需求只存在于聊天历史中时，其输出不可预测。OpenSpec 增加了一个轻量级的规格层，让你在代码编写前就构建目标达成一致。

- **先达成一致再构建**——人类和 AI 在代码编写前对齐规格
- **保持有序**——每个变更拥有独立的文件夹，包含提案、规格、设计和任务
- **灵活工作**——随时更新任何制品，没有僵化的阶段关卡
- **用你习惯的工具**——通过斜杠命令与 20+ 种 AI 助手兼容

### 对比

**vs. [Spec Kit](https://github.com/github/spec-kit)** (GitHub) —— 全面但臃肿。僵化的阶段关卡、大量 Markdown、Python 环境。OpenSpec 更轻量，让你自由迭代。

**vs. [Kiro](https://kiro.dev)** (AWS) —— 功能强大，但绑定其 IDE 且仅限 Claude 模型。OpenSpec 与你现有的工具协同工作。

**vs. 什么也不用** —— 没有规格的 AI 编程意味着模糊的提示和不可预测的结果。OpenSpec 在无繁文缛节的情况下带来了可预测性。

## 更新 OpenSpec

**升级包**

```bash
npm install -g @superkou/openspec@latest
```

**刷新 Agent 指令**

在每个项目内运行以下命令，重新生成 AI 引导并确保最新的斜杠命令生效：

```bash
openspec update
```

## 使用说明

**模型选择**：OpenSpec 在高推理能力模型上表现最佳。建议规划和实现均使用 Codex 5.5 和 Opus 4.7。

**上下文卫生**：OpenSpec 受益于干净的上下文窗口。在开始实现前清除上下文，并在整个会话中保持良好的上下文卫生。

## 贡献

**小修复** —— 错误修复、拼写纠正和小的改进可以直接提交 PR。

**较大变更** —— 对于新功能、重大重构或架构变更，请先提交 OpenSpec 变更提案，以便我们就意图和目标达成一致后再开始实现。

编写提案时，请牢记 OpenSpec 理念：我们服务于不同编码 Agent、模型和使用场景的广大用户。变更应对所有人都友好。

**欢迎 AI 生成的代码** —— 前提是经过测试和验证。包含 AI 生成代码的 PR 应注明使用的编码 Agent 和模型（例如"使用 Claude Code + claude-opus-4-5-20251101 生成"）。

### 开发

- 安装依赖：`pnpm install`
- 构建：`pnpm run build`
- 测试：`pnpm test`
- 本地开发 CLI：`pnpm run dev` 或 `pnpm run dev:cli`
- 规范提交（一行）：`type(scope): subject`

## 其他

<details>
<summary><strong>遥测</strong></summary>

OpenSpec 会收集匿名使用统计。

我们仅收集命令名称和版本以了解使用模式。不会收集参数、路径、内容或个人信息。CI 环境自动禁用。

**退出方式：** `export OPENSPEC_TELEMETRY=0` 或 `export DO_NOT_TRACK=1`

</details>

<details>
<summary><strong>维护者与顾问</strong></summary>

上游维护者见 [MAINTAINERS.md](MAINTAINERS.md) 文件。

</details>

## 许可证

MIT
