import { Command } from 'commander';
import chalk from 'chalk';

import {
  WorkspacePreferredOpener,
  WorkspaceSkillInstallationReport,
  createWorkspaceSkillSkippedReport,
  generateWorkspaceAgentSkills,
  getWorkspaceSkillCapableTools,
  getWorkspaceSkillToolIds,
  getWorkspaceOpenerLabel,
  parseWorkspaceSkillToolsValue,
  updateWorkspaceAgentSkills,
  listKnownWorkspaceEntries,
  readWorkspaceViewState,
  syncWorkspaceOpenSurface,
  writeWorkspaceViewState,
} from '../core/workspace/index.js';
import { isInteractive, resolveNoInteractive } from '../utils/interactive.js';
import {
  addWorkspaceLink,
  createManagedWorkspace,
  loadWorkspaceForDoctor,
  loadWorkspaceForList,
  parseSetupLinks,
  readWorkspaceForMutation,
  updateWorkspaceLink,
  validateWorkspaceNameForSetup,
} from './workspace/operations.js';
import { selectWorkspaceForCommand } from './workspace/selection.js';
import {
  launchWorkspaceOpenCommand,
} from './workspace/open.js';
import {
  buildWorkspaceOpenJsonPayload,
  prepareWorkspaceOpen,
  type PreparedWorkspaceOpen,
} from './workspace/open-view.js';
import {
  getPreferredWorkspaceSkillAgentId,
  parseSetupOpenerOption,
  promptPreferredOpener,
} from './workspace/opener-selection.js';
import { workspacePromptTheme } from './workspace/prompt-theme.js';
import { registerWorkspaceCommandWith } from './workspace/registration.js';
import { promptSetupLinks } from './workspace/setup-prompts.js';
import {
  WorkspaceCliError,
  WorkspaceLinkMutationPayload,
  WorkspaceListOutput,
  WorkspaceLinkOptions,
  WorkspaceListOptions,
  WorkspaceOpenOptions,
  WorkspaceOutput,
  SelectedWorkspace,
  WorkspaceSetupOptions,
  WorkspaceStatus,
  WorkspaceUpdateOptions,
  appendStatus,
  asErrorMessage,
  asStatus,
} from './workspace/types.js';

function printJson(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}

function printWorkspaceSetupIntro(): void {
  console.log(chalk.bold('工作区设置'));
  console.log('');
}

function isPromptCancellationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ExitPromptError' || error.message.includes('force closed the prompt with SIGINT'))
  );
}

async function promptWorkspaceName(initialName?: string): Promise<string> {
  if (initialName) {
    return validateWorkspaceNameForSetup(initialName);
  }

  const { input } = await import('@inquirer/prompts');

  console.log(chalk.bold('[1/5] 命名工作区'));
  console.log(chalk.dim('为仓库组使用一个稳定的名称，例如 platform。'));
  console.log('');

  return input({
    message: '工作区名称：',
    required: true,
    theme: workspacePromptTheme,
    validate(value: string) {
      try {
        validateWorkspaceNameForSetup(value);
        return true;
      } catch {
        return '工作区名称必须是小写字母、数字和单连字符分隔的 kebab-case 格式。';
      }
    },
  });
}

function parseSetupToolsOption(tools: string): string[] {
  try {
    return parseWorkspaceSkillToolsValue(tools);
  } catch (error) {
    throw new WorkspaceCliError(asErrorMessage(error), 'invalid_workspace_setup_tools', {
      target: 'workspace.skills',
      fix: `请使用 --tools all、--tools none，或以下之一：${getWorkspaceSkillToolIds().join(', ')}`,
    });
  }
}

function parseUpdateToolsOption(tools: string): string[] {
  try {
    return parseWorkspaceSkillToolsValue(tools);
  } catch (error) {
    throw new WorkspaceCliError(asErrorMessage(error), 'invalid_workspace_update_tools', {
      target: 'workspace.skills',
      fix: `请使用 --tools all、--tools none，或以下之一：${getWorkspaceSkillToolIds().join(', ')}`,
    });
  }
}

async function promptWorkspaceSkillAgents(
  preferredOpener: WorkspacePreferredOpener | undefined
): Promise<string[]> {
  const { searchableMultiSelect } = await import('../prompts/searchable-multi-select.js');
  const preferredAgentId = getPreferredWorkspaceSkillAgentId(preferredOpener);
  const tools = getWorkspaceSkillCapableTools();
  const sortedChoices = tools
    .map((tool) => ({
      name: tool.name,
      value: tool.value,
      preSelected: tool.value === preferredAgentId,
    }))
    .sort((a, b) => {
      if (a.preSelected !== b.preSelected) {
        return a.preSelected ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });

  if (preferredAgentId) {
    const preferredTool = tools.find((tool) => tool.value === preferredAgentId);
    if (preferredTool) {
      console.log(`${preferredTool.name} 与您偏好的打开方式匹配，已预选。`);
    }
  }

  return searchableMultiSelect({
    message: '哪些 Agent 应该在此工作区中获得 OpenSpec 技能？',
    pageSize: 15,
    choices: sortedChoices,
  });
}

function printStatusLines(statuses: WorkspaceStatus[]): void {
  for (const status of statuses) {
    const label = status.severity === 'warning' ? '警告' : '问题';
    console.log(`${label}：${status.message}`);
    if (status.fix) {
      console.log(`修复：${status.fix}`);
    }
  }
}

function printLinksHuman(links: WorkspaceOutput['links']): void {
  if (links.length === 0) {
    console.log('  （无已链接的仓库或文件夹）');
    return;
  }

  for (const link of links) {
    const suffix = link.status.some((status) => status.severity === 'error') ? ' [问题]' : '';
    console.log(`  ${link.name} -> ${link.path ?? '（未记录本地路径）'}${suffix}`);
    if (link.repo_specs_path) {
      console.log(`    仓库规格：${link.repo_specs_path}`);
    }
  }
}

function collectWorkspaceIssues(workspace: WorkspaceListOutput): WorkspaceStatus[] {
  return [
    ...workspace.status,
    ...workspace.links.flatMap((link) => link.status),
  ];
}

function printDoctorHuman(result: { workspace: WorkspaceOutput; status: WorkspaceStatus[] }): void {
  console.log(`工作区：${result.workspace.name}`);
  console.log(`位置：${result.workspace.root}`);
  if (result.workspace.context) {
    const selector = result.workspace.context.store_selector;
    const suffix = selector.kind === 'path' ? ` 通过 ${selector.path}` : '';
    console.log(
      `上下文：${result.workspace.context.store}/${result.workspace.context.initiative}${suffix}`
    );
  } else {
    console.log('上下文：（无）');
  }
  console.log(`规划路径：${result.workspace.planning_path}`);
  console.log('');
  printStatusLines(result.status);
  if (result.status.length > 0) {
    console.log('');
  }
  console.log('已链接的仓库或文件夹：');
  printLinksHuman(result.workspace.links);

  const issues = collectWorkspaceIssues(result.workspace);

  console.log('');
  console.log('Advisory edit boundaries:');
  if (result.workspace.context) {
    console.log('  Initiative/context-store files are shared coordination context.');
  } else {
    console.log('  No initiative coordination context is attached.');
  }
  console.log('  Linked repos and folders are local implementation context when selected.');

  if (issues.length === 0) {
    console.log('');
    console.log('未发现工作区问题。');
    return;
  }

  console.log('');
  console.log('问题：');
  for (const issue of issues) {
    console.log(`  - ${issue.message}`);
    if (issue.target) {
      console.log(`    目标：${issue.target}`);
    }
    if (issue.fix) {
      console.log(`    修复：${issue.fix}`);
    }
  }
}

function printWorkspaceListHuman(workspaces: WorkspaceListOutput[]): void {
  console.log(chalk.bold(`OpenSpec 工作区（${workspaces.length}）`));

  for (const workspace of workspaces) {
    console.log('');
    console.log(chalk.bold(workspace.name));
    console.log(`  位置：${workspace.root}`);

    if (workspace.status.length > 0) {
      console.log('  状态：');
      for (const status of workspace.status) {
        const statusLabel = status.severity === 'warning' ? chalk.yellow('警告') : chalk.red('问题');
        console.log(`    ${statusLabel}：${status.message}`);
        if (status.fix) {
          console.log(`    修复：${status.fix}`);
        }
      }
    }

    console.log(`  已链接的仓库或文件夹（${workspace.links.length}）：`);
    if (workspace.links.length === 0) {
      console.log(chalk.dim('    （无）'));
      continue;
    }

    for (const link of workspace.links) {
      const suffix = link.status.some((status) => status.severity === 'error') ? chalk.red(' [问题]') : '';
      console.log(`    ${link.name} -> ${link.path ?? '（未记录本地路径）'}${suffix}`);
      if (link.repo_specs_path) {
        console.log(chalk.dim(`      仓库规格：${link.repo_specs_path}`));
      }
    }
  }
}

function printWorkspaceCheckSummaryHuman(result: { workspace: WorkspaceOutput; status: WorkspaceStatus[] }): void {
  printStatusLines(result.status);
  const issues = collectWorkspaceIssues(result.workspace);

  if (issues.length === 0) {
    console.log('  未发现工作区问题。');
    return;
  }

  console.log('  问题：');
  for (const issue of issues) {
    console.log(`    - ${issue.message}`);
    if (issue.target) {
      console.log(`      目标：${issue.target}`);
    }
    if (issue.fix) {
      console.log(`      修复：${issue.fix}`);
    }
  }
}

function printLinkMutationHuman(
  heading: string,
  payload: WorkspaceLinkMutationPayload
): void {
  printStatusLines(payload.status);
  console.log(heading);
  console.log(`  ${payload.link.name} -> ${payload.link.path}`);
  console.log(`工作区：${payload.workspace.name}`);
}

function formatWorkspaceSkillAgentResult(result: { name: string; workflow_ids?: string[] }): string {
  const workflowCount = result.workflow_ids?.length ?? 0;
  const workflowLabel = workflowCount === 1 ? '1 个工作流' : `${workflowCount} 个工作流`;
  return `${result.name}（${workflowLabel}）`;
}

function formatWorkspaceSkillRemovedResult(result: { name: string; workflow_ids?: string[] }): string {
  const workflowCount = result.workflow_ids?.length ?? 0;
  const workflowLabel = workflowCount === 1 ? '1 个工作流' : `${workflowCount} 个工作流`;
  return `${result.name}（${workflowLabel} 已移除）`;
}

function printWorkspaceSkillReportHuman(report: WorkspaceSkillInstallationReport): void {
  console.log('Agent 技能：');
  console.log(`  配置：${report.profile}`);
  console.log(
    `  工作流：${report.workflow_ids.length > 0 ? report.workflow_ids.join(', ') : '（未选择）'}`
  );

  if (report.generated.length > 0) {
    console.log(`  已生成：${report.generated.map(formatWorkspaceSkillAgentResult).join(', ')}`);
  }

  if (report.added.length > 0) {
    console.log(`  已添加：${report.added.map(formatWorkspaceSkillAgentResult).join(', ')}`);
  }

  if (report.refreshed.length > 0) {
    console.log(`  已刷新：${report.refreshed.map(formatWorkspaceSkillAgentResult).join(', ')}`);
  }

  if (report.removed.length > 0) {
    console.log(`  已移除：${report.removed.map(formatWorkspaceSkillRemovedResult).join(', ')}`);
  }

  if (report.skipped.length > 0) {
    for (const skipped of report.skipped) {
      const prefix = skipped.name ? `${skipped.name}：` : '';
      console.log(`  已跳过：${prefix}${skipped.message}`);
    }
  }

  if (report.failed.length > 0) {
    console.log(
      chalk.red(
        `  失败：${report.failed.map((failure) => `${failure.name}（${failure.error}）`).join(', ')}`
      )
    );
  }

  if (report.delivery_notice) {
    console.log(chalk.dim(`  ${report.delivery_notice}`));
  }
}

function hasWorkspaceSkillFailures(report: WorkspaceSkillInstallationReport): boolean {
  return report.failed.length > 0;
}

function setWorkspaceSkillFailureExitCode(report: WorkspaceSkillInstallationReport): void {
  if (hasWorkspaceSkillFailures(report)) {
    process.exitCode = 1;
  }
}

async function writeWorkspaceSkillState(
  workspaceRoot: string,
  selectedAgentIds: string[],
  report: WorkspaceSkillInstallationReport
): Promise<void> {
  const viewState = await readWorkspaceViewState(workspaceRoot);

  await writeWorkspaceViewState(workspaceRoot, {
    ...viewState,
    workspace_skills: {
      selected_agents: selectedAgentIds,
      last_applied_profile: report.profile,
      last_applied_delivery: report.delivery,
      last_applied_workflow_ids: report.workflow_ids,
      last_applied_at: new Date().toISOString(),
    },
  });
}

function resolveUpdateWorkspaceName(
  positionalName: string | undefined,
  options: WorkspaceUpdateOptions
): string | undefined {
  if (positionalName && options.workspace && positionalName !== options.workspace) {
    throw new WorkspaceCliError(
      `工作区选择器冲突：位置参数 '${positionalName}' 和 --workspace '${options.workspace}'。`,
      'workspace_selection_conflict',
      {
        target: 'workspace.name',
        fix: '请使用位置参数的工作区名称或 --workspace 并传相同的值。',
      }
    );
  }

  return positionalName ?? options.workspace;
}

function printWorkspaceOpenHuman(prepared: PreparedWorkspaceOpen): void {
  console.log(`正在打开工作区：${prepared.selected.name}`);
  console.log(`位置：${prepared.selected.root}`);
  if (prepared.initiative) {
    console.log(`计划：${prepared.initiative.store}/${prepared.initiative.id}`);
    console.log(`计划路径：${prepared.initiative.root}`);
  }
  console.log(`打开方式：${getWorkspaceOpenerLabel(prepared.opener)}`);

  if (prepared.skipped.length === 0) {
    return;
  }

  console.log('');
  console.log('跳过的已链接仓库或文件夹：');
  for (const link of prepared.skipped) {
    const location = link.path ?? '（未记录本地路径）';
    console.log(`  ${link.name} -> ${location}`);
  }
  console.log('请使用 openspec workspace doctor 修复跳过的链接。');
}

class WorkspaceCommand {
  async setup(options: WorkspaceSetupOptions = {}): Promise<void> {
    try {
      const noInteractive = resolveNoInteractive(options);

      if (options.json && !noInteractive) {
        throw new WorkspaceCliError(
          'workspace setup --json 需要 --no-interactive。',
          'setup_json_requires_no_interactive',
          {
            fix: 'openspec workspace setup --no-interactive --json --name <name> --link <path>',
          }
        );
      }

      const interactive = !noInteractive && isInteractive(options);
      if (interactive) {
        printWorkspaceSetupIntro();
      }

      if (!interactive && (!options.name || (options.link ?? []).length === 0)) {
        throw new WorkspaceCliError(
          'workspace setup --no-interactive 需要 --name <name> 和至少一个 --link <path>。',
          'missing_setup_inputs',
          {
            fix: 'openspec workspace setup --no-interactive --name platform --link /path/to/repo',
          }
        );
      }

      const workspaceName = interactive
        ? await promptWorkspaceName(options.name)
        : validateWorkspaceNameForSetup(options.name ?? '');
      const links = interactive ? await promptSetupLinks() : await parseSetupLinks(options.link);
      if (interactive) {
        console.log('');
        console.log(chalk.bold('[3/5] 选择偏好打开方式'));
      }
      const preferredOpener = interactive
        ? await promptPreferredOpener('偏好打开方式：')
        : parseSetupOpenerOption(options.opener);

      let selectedWorkspaceSkillAgents: string[] | undefined;
      if (options.tools !== undefined) {
        selectedWorkspaceSkillAgents = parseSetupToolsOption(options.tools);
      } else if (interactive) {
        console.log('');
        console.log(chalk.bold('[4/5] 安装 Agent 技能'));
        console.log(chalk.dim('选择哪些编码 Agent 应在此工作区中获得 OpenSpec 技能。'));
        console.log(chalk.dim('若不选择任何 Agent 直接按回车，则暂时跳过技能安装。'));
        console.log('');
        selectedWorkspaceSkillAgents = await promptWorkspaceSkillAgents(preferredOpener);
      }

      if (Object.keys(links).length === 0) {
        throw new WorkspaceCliError(
          'workspace setup --no-interactive 需要 --name <name> 和至少一个 --link <path>。',
          'missing_setup_inputs',
          {
            fix: 'openspec workspace setup --no-interactive --name platform --link /path/to/repo',
          }
        );
      }

      if (interactive) {
        console.log('');
        console.log(chalk.bold('[5/5] 创建工作区文件'));
      }

      const workspace = await createManagedWorkspace(workspaceName, links, preferredOpener);
      const skillReport =
        selectedWorkspaceSkillAgents === undefined
          ? createWorkspaceSkillSkippedReport(
              'tools_omitted',
              '未安装任何工作区技能。请稍后运行 openspec workspace update --tools <ids> 来安装。'
            )
          : await generateWorkspaceAgentSkills(workspace.root, selectedWorkspaceSkillAgents);

      if (selectedWorkspaceSkillAgents !== undefined && !hasWorkspaceSkillFailures(skillReport)) {
        await writeWorkspaceSkillState(workspace.root, selectedWorkspaceSkillAgents, skillReport);
      }

      const doctorResult = await loadWorkspaceForDoctor({
        name: workspace.name,
        root: workspace.root,
        status: [],
        unregisteredCurrentWorkspace: false,
      });

      if (options.json) {
        printJson({
          workspace: doctorResult.workspace,
          workspace_skills: skillReport,
          status: doctorResult.status,
        });
        setWorkspaceSkillFailureExitCode(skillReport);
        return;
      }

      console.log(chalk.green('工作区设置完成'));
      console.log('');
      printWorkspaceListHuman([doctorResult.workspace]);
      console.log('');
      console.log(`规划路径：${doctorResult.workspace.planning_path}`);
      console.log('');
      console.log('工作区检查：');
      printWorkspaceCheckSummaryHuman(doctorResult);
      console.log('');
      printWorkspaceSkillReportHuman(skillReport);
      console.log('');
      console.log('后续常用命令：');
      console.log(`  openspec workspace doctor --workspace ${workspace.name}`);
      console.log(`  openspec workspace update --workspace ${workspace.name} --tools <ids>`);
      console.log('  openspec workspace list');

      setWorkspaceSkillFailureExitCode(skillReport);
    } catch (error) {
      this.handleFailure(options.json, { workspace: null, status: [] }, error);
    }
  }

  async list(options: WorkspaceListOptions = {}): Promise<void> {
    try {
      const entries = await listKnownWorkspaceEntries();
      const workspaces = await Promise.all(entries.map((entry) => loadWorkspaceForList(entry)));
      const payload = { workspaces, status: [] as WorkspaceStatus[] };

      if (options.json) {
        printJson(payload);
        return;
      }

      if (workspaces.length === 0) {
        console.log("未找到 OpenSpec 工作区。请先运行 'openspec workspace setup'。");
        return;
      }

      printWorkspaceListHuman(workspaces);
    } catch (error) {
      this.handleFailure(options.json, { workspaces: [], status: [] }, error);
    }
  }

  async link(
    nameOrPath: string | undefined,
    linkPath: string | undefined,
    options: WorkspaceLinkOptions = {}
  ): Promise<void> {
    try {
      if (!nameOrPath) {
        throw new WorkspaceCliError(
          'workspace link 需要一个仓库或文件夹路径。',
          'missing_link_path',
          {
            fix: 'openspec workspace link /path/to/repo',
          }
        );
      }

      const selected = await selectWorkspaceForCommand(options, 'link');
      const payload = await addWorkspaceLink(selected, nameOrPath, linkPath);

      if (options.json) {
        printJson(payload);
        return;
      }

      printLinkMutationHuman('已链接的仓库或文件夹：', payload);
    } catch (error) {
      this.handleFailure(options.json, { workspace: null, link: null, status: [] }, error);
    }
  }

  async relink(
    linkNameInput: string | undefined,
    linkPath: string | undefined,
    options: WorkspaceLinkOptions = {}
  ): Promise<void> {
    try {
      if (!linkNameInput || !linkPath) {
        throw new WorkspaceCliError(
          'workspace relink 需要链接名称和仓库或文件夹路径。',
          'missing_relink_arguments',
          {
            fix: 'openspec workspace relink <name> /path/to/repo',
          }
        );
      }

      const selected = await selectWorkspaceForCommand(options, 'relink');
      const payload = await updateWorkspaceLink(selected, linkNameInput, linkPath);

      if (options.json) {
        printJson(payload);
        return;
      }

      printLinkMutationHuman('已重新链接的仓库或文件夹：', payload);
    } catch (error) {
      this.handleFailure(options.json, { workspace: null, link: null, status: [] }, error);
    }
  }

  async doctor(options: WorkspaceLinkOptions = {}): Promise<void> {
    try {
      const selected = await selectWorkspaceForCommand(options, 'doctor');
      const result = await loadWorkspaceForDoctor(selected);

      if (options.json) {
        printJson(result);
        return;
      }

      printDoctorHuman(result);
    } catch (error) {
      this.handleFailure(options.json, { workspace: null, status: [] }, error);
    }
  }

  async update(
    positionalName: string | undefined,
    options: WorkspaceUpdateOptions = {}
  ): Promise<void> {
    try {
      const workspaceName = resolveUpdateWorkspaceName(positionalName, options);
      const selected = await selectWorkspaceForCommand(
        {
          ...options,
          workspace: workspaceName,
        },
        'update',
        { preferPositionalName: Boolean(positionalName) }
      );
      await this.updateSelected(selected, options);
    } catch (error) {
      this.handleFailure(options.json, { workspace: null, workspace_skills: null, status: [] }, error);
    }
  }

  private async updateSelected(
    selected: SelectedWorkspace,
    options: WorkspaceUpdateOptions
  ): Promise<void> {
    const viewState = await readWorkspaceForMutation(selected);
    await syncWorkspaceOpenSurface(selected.root, viewState);

    const hasExplicitToolSelection = options.tools !== undefined;
    const selectedAgentIds = hasExplicitToolSelection
      ? parseUpdateToolsOption(options.tools ?? '')
      : viewState.workspace_skills?.selected_agents ?? [];
    const previousSkillState =
      hasExplicitToolSelection
        ? viewState.workspace_skills ?? { selected_agents: [] }
        : viewState.workspace_skills;
    const skillReport = await updateWorkspaceAgentSkills(
      selected.root,
      selectedAgentIds,
      previousSkillState
    );
    const shouldStoreSelection = hasExplicitToolSelection || Boolean(viewState.workspace_skills);

    if (shouldStoreSelection && !hasWorkspaceSkillFailures(skillReport)) {
      await writeWorkspaceSkillState(selected.root, selectedAgentIds, skillReport);
    }

    const doctorResult = await loadWorkspaceForDoctor(selected);

    if (options.json) {
      printJson({
        workspace: doctorResult.workspace,
        workspace_skills: skillReport,
        status: doctorResult.status,
      });
      setWorkspaceSkillFailureExitCode(skillReport);
      return;
    }

    console.log(chalk.green('工作区更新完成'));
    console.log(`工作区：${doctorResult.workspace.name}`);
    console.log(`位置：${doctorResult.workspace.root}`);
    console.log('');
    printStatusLines(doctorResult.status);
    if (doctorResult.status.length > 0) {
      console.log('');
    }
    printWorkspaceSkillReportHuman(skillReport);
    console.log('');
    console.log('后续常用命令：');
    console.log(`  openspec workspace doctor --workspace ${doctorResult.workspace.name}`);
    console.log(`  openspec workspace update --workspace ${doctorResult.workspace.name} --tools <ids>`);

    setWorkspaceSkillFailureExitCode(skillReport);
  }

  async open(
    positionalName: string | undefined,
    options: WorkspaceOpenOptions = {}
  ): Promise<void> {
    try {
      const prepared = await prepareWorkspaceOpen(positionalName, options);

      if (!options.json) {
        printStatusLines(prepared.selected.status);
        if (prepared.selected.status.length > 0) {
          console.log('');
        }
        printWorkspaceOpenHuman(prepared);
      }

      await launchWorkspaceOpenCommand(prepared.command, {
        stdio: options.json ? 'ignore' : 'inherit',
      });

      if (options.json) {
        printJson(buildWorkspaceOpenJsonPayload(prepared));
      }
    } catch (error) {
      this.handleFailure(options.json, { workspace: null, status: [] }, error);
    }
  }

  private handleFailure<T extends { status: WorkspaceStatus[] }>(
    json: boolean | undefined,
    payload: T,
    error: unknown
  ): void {
    if (!json && isPromptCancellationError(error)) {
      console.error('已取消。');
      process.exitCode = 130;
      return;
    }

    if (json) {
      printJson(appendStatus(payload, asStatus(error)));
      process.exitCode = 1;
      return;
    }

    const status = asStatus(error);
    console.error(`错误：${status.message}`);
    if (status.fix) {
      console.error(`修复：${status.fix}`);
    }
    process.exitCode = 1;
  }
}

export async function runWorkspaceUpdate(
  positionalName: string | undefined,
  options: WorkspaceUpdateOptions = {}
): Promise<void> {
  const workspaceCommand = new WorkspaceCommand();
  await workspaceCommand.update(positionalName, options);
}

export function registerWorkspaceCommand(program: Command): void {
  registerWorkspaceCommandWith(program, new WorkspaceCommand());
}
}
