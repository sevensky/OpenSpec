/**
 * ZCode Command Adapter
 *
 * Formats commands for ZCode CLI following its command specification.
 * ZCode 在 .zcode/commands/ 下使用扁平的 opsx-<id>.md 命令文件，
 * frontmatter 含 description 与可选的 argument-hint。
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
