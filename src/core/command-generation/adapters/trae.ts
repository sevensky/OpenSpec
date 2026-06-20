/**
 * Trae Command Adapter
 *
 * Formats commands for Trae following its command specification.
 * Docs: Trae IDE 官方文档 - 命令功能
 *
 * Trae 支持项目级命令（.trae/commands/）和全局命令（~/.trae/commands/），
 * 支持最多 3 层目录嵌套。本 adapter 生成项目级命令，路径为
 * .trae/commands/opsx/<id>.md（2 层嵌套，在 3 层限制内）。
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
