import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ora from 'ora';
import { stringify as stringifyYaml } from 'yaml';
import {
  getSchemaDir,
  getProjectSchemasDir,
  getUserSchemasDir,
  getPackageSchemasDir,
  listSchemas,
} from '../core/artifact-graph/resolver.js';
import { parseSchema, SchemaValidationError } from '../core/artifact-graph/schema.js';
import type { SchemaYaml, Artifact } from '../core/artifact-graph/types.js';

/**
 * Schema source location type
 */
type SchemaSource = 'project' | 'user' | 'package';

/**
 * Result of checking a schema location
 */
interface SchemaLocation {
  source: SchemaSource;
  path: string;
  exists: boolean;
}

/**
 * Schema resolution info with shadowing details
 */
interface SchemaResolution {
  name: string;
  source: SchemaSource;
  path: string;
  shadows: Array<{ source: SchemaSource; path: string }>;
}

/**
 * Validation issue structure
 */
interface ValidationIssue {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

/**
 * Check all three locations for a schema and return which ones exist.
 */
function checkAllLocations(
  name: string,
  projectRoot: string
): SchemaLocation[] {
  const locations: SchemaLocation[] = [];

  // Project location
  const projectDir = path.join(getProjectSchemasDir(projectRoot), name);
  const projectSchemaPath = path.join(projectDir, 'schema.yaml');
  locations.push({
    source: 'project',
    path: projectDir,
    exists: fs.existsSync(projectSchemaPath),
  });

  // User location
  const userDir = path.join(getUserSchemasDir(), name);
  const userSchemaPath = path.join(userDir, 'schema.yaml');
  locations.push({
    source: 'user',
    path: userDir,
    exists: fs.existsSync(userSchemaPath),
  });

  // Package location
  const packageDir = path.join(getPackageSchemasDir(), name);
  const packageSchemaPath = path.join(packageDir, 'schema.yaml');
  locations.push({
    source: 'package',
    path: packageDir,
    exists: fs.existsSync(packageSchemaPath),
  });

  return locations;
}

/**
 * Get resolution info for a schema including shadow detection.
 */
function getSchemaResolution(
  name: string,
  projectRoot: string
): SchemaResolution | null {
  const locations = checkAllLocations(name, projectRoot);
  const existingLocations = locations.filter((loc) => loc.exists);

  if (existingLocations.length === 0) {
    return null;
  }

  const active = existingLocations[0];
  const shadows = existingLocations.slice(1).map((loc) => ({
    source: loc.source,
    path: loc.path,
  }));

  return {
    name,
    source: active.source,
    path: active.path,
    shadows,
  };
}

/**
 * Get all schemas with resolution info.
 */
function getAllSchemasWithResolution(
  projectRoot: string
): SchemaResolution[] {
  const schemaNames = listSchemas(projectRoot);
  const results: SchemaResolution[] = [];

  for (const name of schemaNames) {
    const resolution = getSchemaResolution(name, projectRoot);
    if (resolution) {
      results.push(resolution);
    }
  }

  return results;
}

/**
 * Validate a schema and return issues.
 */
function validateSchema(
  schemaDir: string,
  verbose: boolean = false
): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const schemaPath = path.join(schemaDir, 'schema.yaml');

  // Check schema.yaml exists
  if (verbose) {
    console.log('  检查 schema.yaml 是否存在...');
  }
  if (!fs.existsSync(schemaPath)) {
    issues.push({
      level: 'error',
      path: 'schema.yaml',
      message: '未找到 schema.yaml',
    });
    return { valid: false, issues };
  }

  // Parse YAML
  if (verbose) {
    console.log('  正在解析 YAML...');
  }
  let content: string;
  try {
    content = fs.readFileSync(schemaPath, 'utf-8');
  } catch (err) {
    issues.push({
      level: 'error',
      path: 'schema.yaml',
      message: `读取文件失败：${(err as Error).message}`,
    });
    return { valid: false, issues };
  }

  // Validate against Zod schema
  if (verbose) {
    console.log('  正在验证架构结构...');
  }
  let schema: SchemaYaml;
  try {
    schema = parseSchema(content);
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      issues.push({
        level: 'error',
        path: 'schema.yaml',
        message: err.message,
      });
    } else {
      issues.push({
        level: 'error',
        path: 'schema.yaml',
        message: `解析错误：${(err as Error).message}`,
      });
    }
    return { valid: false, issues };
  }

  // Check template files exist
  // Templates can be in schemaDir directly or in a templates/ subdirectory
  if (verbose) {
    console.log('  正在检查模板文件...');
  }
  for (const artifact of schema.artifacts) {
    // Try templates subdirectory first (standard location), then root
    const templatePathInTemplates = path.join(schemaDir, 'templates', artifact.template);
    const templatePathInRoot = path.join(schemaDir, artifact.template);

    if (!fs.existsSync(templatePathInTemplates) && !fs.existsSync(templatePathInRoot)) {
      issues.push({
        level: 'error',
        path: `artifacts.${artifact.id}.template`,
        message: `制品 '${artifact.id}' 的模板文件 '${artifact.template}' 未找到`,
      });
    }
  }

  // Dependency graph validation is already done by parseSchema
  // (it throws on cycles and invalid references)
  if (verbose) {
    console.log('  依赖图验证已通过（通过 parseSchema）');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate schema name format (kebab-case).
 */
function isValidSchemaName(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
}

/**
 * Copy a directory recursively.
 */
function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Default artifacts with descriptions for schema init.
 */
const DEFAULT_ARTIFACTS: Array<{
  id: string;
  description: string;
  generates: string;
  template: string;
}> = [
  {
    id: 'proposal',
    description: '变更的高层描述、动机和范围',
    generates: 'proposal.md',
    template: 'proposal.md',
  },
  {
    id: 'specs',
    description: '包含需求和场景的详细规格说明',
    generates: 'specs/**/*.md',
    template: 'specs/spec.md',
  },
  {
    id: 'design',
    description: '技术设计决策和实现方案',
    generates: 'design.md',
    template: 'design.md',
  },
  {
    id: 'tasks',
    description: '包含可追踪任务的任务清单',
    generates: 'tasks.md',
    template: 'tasks.md',
  },
];

/**
 * Register the schema command and all its subcommands.
 */
export function registerSchemaCommand(program: Command): void {
  const schemaCmd = program
    .command('schema')
    .description('管理工作流架构 [实验性]');

  // Experimental warning
  schemaCmd.hook('preAction', () => {
    console.error('注意：架构命令为实验性功能，可能发生变化。');
  });

  // schema which
  schemaCmd
    .command('which [name]')
    .description('查看架构的来源解析位置')
    .option('--json', '以 JSON 格式输出')
    .option('--all', '列出所有架构及其解析来源')
    .action(async (name?: string, options?: { json?: boolean; all?: boolean }) => {
      try {
        const projectRoot = process.cwd();

        if (options?.all) {
          // List all schemas
          const schemas = getAllSchemasWithResolution(projectRoot);

          if (options?.json) {
            console.log(JSON.stringify(schemas, null, 2));
          } else {
            if (schemas.length === 0) {
              console.log('未找到架构。');
              return;
            }

            // Group by source
            const bySource = {
              project: schemas.filter((s) => s.source === 'project'),
              user: schemas.filter((s) => s.source === 'user'),
              package: schemas.filter((s) => s.source === 'package'),
            };

            if (bySource.project.length > 0) {
              console.log('\n项目架构：');
              for (const schema of bySource.project) {
                const shadowInfo = schema.shadows.length > 0
                  ? ` (遮蔽：${schema.shadows.map((s) => s.source).join(', ')})`
                  : '';
                console.log(`  ${schema.name}${shadowInfo}`);
              }
            }

            if (bySource.user.length > 0) {
              console.log('\n用户架构：');
              for (const schema of bySource.user) {
                const shadowInfo = schema.shadows.length > 0
                  ? ` (遮蔽：${schema.shadows.map((s) => s.source).join(', ')})`
                  : '';
                console.log(`  ${schema.name}${shadowInfo}`);
              }
            }

            if (bySource.package.length > 0) {
              console.log('\n包架构：');
              for (const schema of bySource.package) {
                console.log(`  ${schema.name}`);
              }
            }
          }
          return;
        }

        if (!name) {
          console.error('错误：需要指定架构名称（或使用 --all 列出所有架构）');
          process.exitCode = 1;
          return;
        }

        const resolution = getSchemaResolution(name, projectRoot);

        if (!resolution) {
          const available = listSchemas(projectRoot);
          if (options?.json) {
            console.log(JSON.stringify({
              error: `架构 '${name}' 未找到`,
              available,
            }, null, 2));
          } else {
            console.error(`错误：架构 '${name}' 未找到`);
            console.error(`可用架构：${available.join(', ')}`);
          }
          process.exitCode = 1;
          return;
        }

        if (options?.json) {
          console.log(JSON.stringify(resolution, null, 2));
        } else {
          console.log(`架构：${resolution.name}`);
          console.log(`来源：${resolution.source}`);
          console.log(`路径：${resolution.path}`);

          if (resolution.shadows.length > 0) {
            console.log('\n遮蔽来源：');
            for (const shadow of resolution.shadows) {
              console.log(`  ${shadow.source}: ${shadow.path}`);
            }
          }
        }
      } catch (error) {
        console.error(`错误：${(error as Error).message}`);
        process.exitCode = 1;
      }
    });

  // schema validate
  schemaCmd
    .command('validate [name]')
    .description('验证架构结构和模板')
    .option('--json', '以 JSON 格式输出')
    .option('--verbose', '显示详细的验证步骤')
    .action(async (name?: string, options?: { json?: boolean; verbose?: boolean }) => {
      try {
        const projectRoot = process.cwd();

        if (!name) {
          // Validate all project schemas
          const projectSchemasDir = getProjectSchemasDir(projectRoot);

          if (!fs.existsSync(projectSchemasDir)) {
            if (options?.json) {
              console.log(JSON.stringify({
                valid: true,
                message: 'No project schemas directory found',
                schemas: [],
              }, null, 2));
            } else {
              console.log('未找到项目架构目录。');
            }
            return;
          }

          const entries = fs.readdirSync(projectSchemasDir, { withFileTypes: true });
          const schemaResults: Array<{
            name: string;
            path: string;
            valid: boolean;
            issues: ValidationIssue[];
          }> = [];

          let anyInvalid = false;

          for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const schemaDir = path.join(projectSchemasDir, entry.name);
            const schemaPath = path.join(schemaDir, 'schema.yaml');

            if (!fs.existsSync(schemaPath)) continue;

            if (options?.verbose && !options?.json) {
              console.log(`\n正在验证 ${entry.name}...`);
            }

            const result = validateSchema(schemaDir, options?.verbose && !options?.json);
            schemaResults.push({
              name: entry.name,
              path: schemaDir,
              valid: result.valid,
              issues: result.issues,
            });

            if (!result.valid) {
              anyInvalid = true;
            }
          }

          if (options?.json) {
            console.log(JSON.stringify({
              valid: !anyInvalid,
              schemas: schemaResults,
            }, null, 2));
          } else {
            if (schemaResults.length === 0) {
              console.log('项目中未找到架构。');
              return;
            }

            console.log('\n验证结果：');
            for (const result of schemaResults) {
              const status = result.valid ? '✓' : '✗';
              console.log(`  ${status} ${result.name}`);
              for (const issue of result.issues) {
                console.log(`    ${issue.level}: ${issue.message}`);
              }
            }

            if (anyInvalid) {
              process.exitCode = 1;
            }
          }
          return;
        }

        // Validate specific schema
        const schemaDir = getSchemaDir(name, projectRoot);

        if (!schemaDir) {
          const available = listSchemas(projectRoot);
          if (options?.json) {
            console.log(JSON.stringify({
              valid: false,
              error: `架构 '${name}' 未找到`,
              available,
            }, null, 2));
          } else {
            console.error(`错误：架构 '${name}' 未找到`);
            console.error(`可用架构：${available.join(', ')}`);
          }
          process.exitCode = 1;
          return;
        }

        if (options?.verbose && !options?.json) {
          console.log(`正在验证 ${name}...`);
        }

        const result = validateSchema(schemaDir, options?.verbose && !options?.json);

        if (options?.json) {
          console.log(JSON.stringify({
            name,
            path: schemaDir,
            valid: result.valid,
            issues: result.issues,
          }, null, 2));
        } else {
          if (result.valid) {
            console.log(`✓ 架构 '${name}' 有效`);
          } else {
            console.log(`✗ 架构 '${name}' 存在错误：`);
            for (const issue of result.issues) {
              console.log(`  ${issue.level}: ${issue.message}`);
            }
            process.exitCode = 1;
          }
        }
      } catch (error) {
        if (options?.json) {
          console.log(JSON.stringify({
            valid: false,
            error: (error as Error).message,
          }, null, 2));
        } else {
          console.error(`错误：${(error as Error).message}`);
        }
        process.exitCode = 1;
      }
    });

  // schema fork
  schemaCmd
    .command('fork <source> [name]')
    .description('复制现有架构到项目进行自定义')
    .option('--json', '以 JSON 格式输出')
    .option('--force', '覆盖已存在的目标')
    .action(async (source: string, name?: string, options?: { json?: boolean; force?: boolean }) => {
      const spinner = options?.json ? null : ora();

      try {
        const projectRoot = process.cwd();
        const destinationName = name || `${source}-custom`;

        // Validate destination name
        if (!isValidSchemaName(destinationName)) {
          if (options?.json) {
            console.log(JSON.stringify({
              forked: false,
              error: `无效的架构名称 '${destinationName}'。请使用 kebab-case（如 my-workflow）`,
            }, null, 2));
          } else {
            console.error(`错误：无效的架构名称 '${destinationName}'`);
            console.error('架构名称必须使用 kebab-case 格式（如 my-workflow）');
          }
          process.exitCode = 1;
          return;
        }

        // Find source schema
        const sourceDir = getSchemaDir(source, projectRoot);
        if (!sourceDir) {
          const available = listSchemas(projectRoot);
          if (options?.json) {
            console.log(JSON.stringify({
              forked: false,
              error: `架构 '${source}' 未找到`,
              available,
            }, null, 2));
          } else {
            console.error(`错误：架构 '${source}' 未找到`);
            console.error(`可用架构：${available.join(', ')}`);
          }
          process.exitCode = 1;
          return;
        }

        // Determine source location
        const sourceResolution = getSchemaResolution(source, projectRoot);
        const sourceLocation = sourceResolution?.source || 'package';

        // Check destination
        const destinationDir = path.join(getProjectSchemasDir(projectRoot), destinationName);

        if (fs.existsSync(destinationDir)) {
          if (!options?.force) {
            if (options?.json) {
              console.log(JSON.stringify({
                forked: false,
                error: `架构 '${destinationName}' 已存在`,
                suggestion: '使用 --force 覆盖',
              }, null, 2));
            } else {
              console.error(`错误：架构 '${destinationName}' 已存在于 ${destinationDir}`);
              console.error('使用 --force 覆盖');
            }
            process.exitCode = 1;
            return;
          }

          // Remove existing
          if (spinner) spinner.start(`正在移除现有架构 '${destinationName}'...`);
          fs.rmSync(destinationDir, { recursive: true });
        }

        // Copy schema
        if (spinner) spinner.start(`正在派生 '${source}' 到 '${destinationName}'...`);
        copyDirRecursive(sourceDir, destinationDir);

        // Update name in schema.yaml
        const destSchemaPath = path.join(destinationDir, 'schema.yaml');
        const schemaContent = fs.readFileSync(destSchemaPath, 'utf-8');
        const schema = parseSchema(schemaContent);
        schema.name = destinationName;

        fs.writeFileSync(destSchemaPath, stringifyYaml(schema));

        if (spinner) spinner.succeed(`已派生 '${source}' 到 '${destinationName}'`);

        if (options?.json) {
          console.log(JSON.stringify({
            forked: true,
            source,
            sourcePath: sourceDir,
            sourceLocation,
            destination: destinationName,
            destinationPath: destinationDir,
          }, null, 2));
        } else {
          console.log(`\n来源：${sourceDir}（${sourceLocation}）`);
          console.log(`目标：${destinationDir}`);
          console.log(`\n你现在可以自定义架构：`);
          console.log(`  ${destinationDir}/schema.yaml`);
        }
      } catch (error) {
        if (spinner) spinner.fail(`派生失败`);
        if (options?.json) {
          console.log(JSON.stringify({
            forked: false,
            error: (error as Error).message,
          }, null, 2));
        } else {
          console.error(`错误：${(error as Error).message}`);
        }
        process.exitCode = 1;
      }
    });

  // schema init
  schemaCmd
    .command('init <name>')
    .description('创建新的项目本地架构')
    .option('--json', '以 JSON 格式输出')
    .option('--description <text>', '架构描述')
    .option('--artifacts <list>', '逗号分隔的制品 ID 列表（proposal,specs,design,tasks）')
    .option('--default', '设置为项目默认架构')
    .option('--no-default', '不提示设置为默认')
    .option('--force', '覆盖已有架构')
    .action(async (
      name: string,
      options?: {
        json?: boolean;
        description?: string;
        artifacts?: string;
        default?: boolean;
        force?: boolean;
      }
    ) => {
      const spinner = options?.json ? null : ora();

      try {
        const projectRoot = process.cwd();

        // Validate name
        if (!isValidSchemaName(name)) {
          if (options?.json) {
            console.log(JSON.stringify({
              created: false,
              error: `无效的架构名称 '${name}'。请使用 kebab-case（如 my-workflow）`,
            }, null, 2));
          } else {
            console.error(`错误：无效的架构名称 '${name}'`);
            console.error('架构名称必须使用 kebab-case 格式（如 my-workflow）');
          }
          process.exitCode = 1;
          return;
        }

        const schemaDir = path.join(getProjectSchemasDir(projectRoot), name);

        // Check if exists
        if (fs.existsSync(schemaDir)) {
          if (!options?.force) {
            if (options?.json) {
              console.log(JSON.stringify({
                created: false,
                error: `架构 '${name}' 已存在`,
                suggestion: '使用 --force 覆盖或使用 "openspec schema fork" 复制',
              }, null, 2));
            } else {
              console.error(`错误：架构 '${name}' 已存在于 ${schemaDir}`);
              console.error('使用 --force 覆盖或使用 "openspec schema fork" 复制');
            }
            process.exitCode = 1;
            return;
          }

          if (spinner) spinner.start(`正在移除现有架构 '${name}'...`);
          fs.rmSync(schemaDir, { recursive: true });
        }

        // Determine artifacts and description
        let description: string;
        let selectedArtifactIds: string[];

        // Check if we have explicit flags (non-interactive mode)
        const hasExplicitOptions = options?.description !== undefined || options?.artifacts !== undefined;
        const isInteractive = !options?.json && !hasExplicitOptions && process.stdout.isTTY;

        if (isInteractive) {
          // Interactive mode
          const { input, checkbox, confirm } = await import('@inquirer/prompts');

          description = await input({
            message: '架构描述：',
            default: `用于 ${name} 的自定义工作流架构`,
          });

          const artifactChoices = DEFAULT_ARTIFACTS.map((a) => ({
            name: a.id,
            value: a.id,
            checked: true,
          }));

          selectedArtifactIds = await checkbox({
            message: '选择要包含的制品：',
            choices: artifactChoices,
          });

          if (selectedArtifactIds.length === 0) {
            console.error('错误：至少需要选择一个制品');
            process.exitCode = 1;
            return;
          }

          // Ask about setting as default (unless --no-default was passed)
          if (options?.default === undefined) {
            const setAsDefault = await confirm({
              message: '设置为项目默认架构？',
              default: false,
            });

            if (setAsDefault) {
              options = { ...options, default: true };
            }
          }
        } else {
          // Non-interactive mode
          description = options?.description || `用于 ${name} 的自定义工作流架构`;

          if (options?.artifacts) {
            selectedArtifactIds = options.artifacts.split(',').map((a) => a.trim());

            // Validate artifact IDs
            const validIds = DEFAULT_ARTIFACTS.map((a) => a.id);
            for (const id of selectedArtifactIds) {
              if (!validIds.includes(id)) {
                if (options?.json) {
                  console.log(JSON.stringify({
                    created: false,
                    error: `未知的制品 '${id}'`,
                    valid: validIds,
                  }, null, 2));
                } else {
                  console.error(`错误：未知的制品 '${id}'`);
                  console.error(`有效制品：${validIds.join(', ')}`);
                }
                process.exitCode = 1;
                return;
              }
            }
          } else {
            // Default to all artifacts
            selectedArtifactIds = DEFAULT_ARTIFACTS.map((a) => a.id);
          }
        }

        // Create schema directory
        if (spinner) spinner.start(`正在创建架构 '${name}'...`);
        fs.mkdirSync(schemaDir, { recursive: true });

        // Build artifacts array with proper dependencies
        const selectedArtifacts = selectedArtifactIds.map((id) => {
          const template = DEFAULT_ARTIFACTS.find((a) => a.id === id)!;
          const artifact: Artifact = {
            id: template.id,
            generates: template.generates,
            description: template.description,
            template: template.template,
            requires: [],
          };

          // Set up dependencies based on typical workflow
          if (id === 'specs' && selectedArtifactIds.includes('proposal')) {
            artifact.requires = ['proposal'];
          } else if (id === 'design' && selectedArtifactIds.includes('specs')) {
            artifact.requires = ['specs'];
          } else if (id === 'tasks') {
            const requires: string[] = [];
            if (selectedArtifactIds.includes('design')) requires.push('design');
            else if (selectedArtifactIds.includes('specs')) requires.push('specs');
            artifact.requires = requires;
          }

          return artifact;
        });

        // Create schema.yaml
        const schema: SchemaYaml = {
          name,
          version: 1,
          description,
          artifacts: selectedArtifacts,
        };

        // Add apply phase if tasks is included
        if (selectedArtifactIds.includes('tasks')) {
          schema.apply = {
            requires: ['tasks'],
            tracks: 'tasks.md',
          };
        }

        fs.writeFileSync(
          path.join(schemaDir, 'schema.yaml'),
          stringifyYaml(schema)
        );

        // Create template files in templates/ subdirectory (standard location)
        const templatesDir = path.join(schemaDir, 'templates');
        for (const artifact of selectedArtifacts) {
          const templatePath = path.join(templatesDir, artifact.template);
          const templateDir = path.dirname(templatePath);

          if (!fs.existsSync(templateDir)) {
            fs.mkdirSync(templateDir, { recursive: true });
          }

          // Create default template content
          const templateContent = createDefaultTemplate(artifact.id);
          fs.writeFileSync(templatePath, templateContent);
        }

        // Update config if --default
        if (options?.default) {
          const configPath = path.join(projectRoot, 'openspec', 'config.yaml');

          if (fs.existsSync(configPath)) {
            const { parse: parseYaml, stringify: stringifyYaml2 } = await import('yaml');
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config = parseYaml(configContent) || {};
            config.defaultSchema = name;
            fs.writeFileSync(configPath, stringifyYaml2(config));
          } else {
            // Create config file
            const configDir = path.dirname(configPath);
            if (!fs.existsSync(configDir)) {
              fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(configPath, stringifyYaml({ defaultSchema: name }));
          }
        }

        if (spinner) spinner.succeed(`已创建架构 '${name}'`);

        if (options?.json) {
          console.log(JSON.stringify({
            created: true,
            path: schemaDir,
            schema: name,
            artifacts: selectedArtifactIds,
            setAsDefault: options?.default || false,
          }, null, 2));
        } else {
          console.log(`\n架构已创建于：${schemaDir}`);
          console.log(`\n制品：${selectedArtifactIds.join(', ')}`);
          if (options?.default) {
            console.log(`\n已设置为项目默认架构。`);
          }
          console.log(`\n下一步操作：`);
          console.log(`  1. 编辑 ${schemaDir}/schema.yaml 自定义制品`);
          console.log(`  2. 修改架构目录中的模板`);
          console.log(`  3. 使用命令：openspec new --schema ${name}`);
        }
      } catch (error) {
        if (spinner) spinner.fail(`创建失败`);
        if (options?.json) {
          console.log(JSON.stringify({
            created: false,
            error: (error as Error).message,
          }, null, 2));
        } else {
          console.error(`错误：${(error as Error).message}`);
        }
        process.exitCode = 1;
      }
    });
}

/**
 * Create default template content for an artifact.
 */
function createDefaultTemplate(artifactId: string): string {
  switch (artifactId) {
    case 'proposal':
      return `## Why

<!-- 描述此变更的动机 -->

## What Changes

<!-- 描述将要变更的内容 -->

## Capabilities

### New Capabilities
<!-- 列出新能力 -->

### Modified Capabilities
<!-- 列出已修改的能力 -->

## Impact

<!-- 描述对现有功能的影响 -->
`;

    case 'specs':
      return `## ADDED Requirements

### Requirement: Example requirement

描述该需求。

#### Scenario: Example scenario
- **WHEN** 某个条件
- **THEN** 某个结果
`;

    case 'design':
      return `## Context

<!-- 背景和上下文 -->

## Goals / Non-Goals

**目标：**
<!-- 列出目标 -->

**非目标：**
<!-- 列出非目标 -->

## Decisions

### 1. 决策名称

描述和理由。

**考虑过的替代方案：**
- 方案 1：因...被拒绝

## Risks / Trade-offs

<!-- 列出风险与权衡 -->
`;

    case 'tasks':
      return `## Implementation Tasks

- [ ] 任务 1
- [ ] 任务 2
- [ ] 任务 3
`;

    default:
      return `## ${artifactId}

<!-- 在此添加内容 -->
`;
  }
}
