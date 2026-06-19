/**
 * Validation threshold constants
 */

// Minimum character lengths
export const MIN_WHY_SECTION_LENGTH = 50;
export const MIN_PURPOSE_LENGTH = 50;

// Maximum character/item limits
export const MAX_WHY_SECTION_LENGTH = 1000;
export const MAX_REQUIREMENT_TEXT_LENGTH = 500;
export const MAX_DELTAS_PER_CHANGE = 10;

// Validation messages
export const VALIDATION_MESSAGES = {
  // Required content
  SCENARIO_EMPTY: '场景描述不能为空',
  REQUIREMENT_EMPTY: '需求描述不能为空',
  REQUIREMENT_NO_SHALL: '需求必须包含 SHALL、MUST、必须 或 应当',
  REQUIREMENT_NO_SCENARIOS: '每个需求至少需要一个场景',
  SPEC_NAME_EMPTY: 'Spec 名称不能为空',
  SPEC_PURPOSE_EMPTY: 'Purpose 段落不能为空',
  SPEC_NO_REQUIREMENTS: 'Spec 至少需要一个需求',
  CHANGE_NAME_EMPTY: '变更名称不能为空',
  CHANGE_WHY_TOO_SHORT: `Why 段落至少需要 ${MIN_WHY_SECTION_LENGTH} 个字符`,
  CHANGE_WHY_TOO_LONG: `Why 段落不应超过 ${MAX_WHY_SECTION_LENGTH} 个字符`,
  CHANGE_WHAT_EMPTY: 'What Changes 段落不能为空',
  CHANGE_NO_DELTAS: '变更必须至少包含一个 delta',
  CHANGE_TOO_MANY_DELTAS: `建议将超过 ${MAX_DELTAS_PER_CHANGE} 个 delta 的变更拆分`,
  DELTA_SPEC_EMPTY: 'Spec 名称不能为空',
  DELTA_DESCRIPTION_EMPTY: 'Delta 描述不能为空',

  // Warnings
  PURPOSE_TOO_BRIEF: `Purpose 段落过短（不足 ${MIN_PURPOSE_LENGTH} 个字符）`,
  REQUIREMENT_TOO_LONG: `需求文本过长（超过 ${MAX_REQUIREMENT_TEXT_LENGTH} 个字符），建议拆分`,
  DELTA_DESCRIPTION_TOO_BRIEF: 'Delta 描述过短',
  DELTA_MISSING_REQUIREMENTS: 'Delta 应包含需求描述',

  // Guidance snippets (appended to primary messages for remediation)
  GUIDE_NO_DELTAS:
    '未找到 delta。请确保变更的 specs/ 目录下有能力子目录（如 specs/http-server/spec.md），其中的 .md 文件使用了 delta 标题（## ADDED/MODIFIED/REMOVED/RENAMED Requirements），且每个需求至少包含一个 "#### Scenario:" 块。提示：运行 "openspec change show <change-id> --json --deltas-only" 可检查解析结果。',
  GUIDE_MISSING_SPEC_SECTIONS:
    '缺少必需段落。预期标题： "## Purpose" 和 "## Requirements"。示例：\n## Purpose\n[简述目的]\n\n## Requirements\n### Requirement: 明确的需求描述\n系统 SHALL ...\n\n#### Scenario: 场景名称\n- **WHEN** ...\n- **THEN** ...',
  GUIDE_MISSING_CHANGE_SECTIONS:
    '缺少必需段落。预期标题： "## Why" 和 "## What Changes"。请确保变更在 specs/ 中使用 delta 标题记录了变更。',
  GUIDE_SCENARIO_FORMAT:
    '场景必须使用四级标题。请将列表转换为：\n#### Scenario: 简短名称\n- **WHEN** ...\n- **THEN** ...\n- **AND** ...',
} as const;
