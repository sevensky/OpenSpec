import path from 'path';
import { FileSystemUtils } from './file-system.js';
import { writeChangeMetadata, validateSchemaName } from './change-metadata.js';
import { readProjectConfig } from '../core/project-config.js';
import type { ChangeMetadata } from '../core/change-metadata/index.js';

const DEFAULT_SCHEMA = 'spec-driven';

/**
 * Options for creating a change.
 */
export interface CreateChangeOptions {
  /** The workflow schema to use (default: 'spec-driven') */
  schema?: string;
  /** Default schema to use when no explicit schema or project config is present */
  defaultSchema?: string;
  /** Directory that should contain the change directories */
  changesDir?: string;
  /** Additional metadata to persist in the change's .openspec.yaml */
  metadata?: Partial<Pick<ChangeMetadata, 'goal' | 'affected_areas' | 'initiative'>>;
}

/**
 * Result of creating a change.
 */
export interface CreateChangeResult {
  /** The schema that was actually used (resolved from options, config, or default) */
  schema: string;
  /** Absolute path to the created change directory */
  changeDir: string;
}

/**
 * Result of validating a change name.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a change name follows kebab-case conventions.
 *
 * Valid names (two accepted forms):
 * - Classic kebab-case: starts with a lowercase letter
 *   (e.g., `add-auth`, `refactor-db`)
 * - MMDD-prefixed kebab-case: starts with a 4-digit date (MMDD) followed by `-`
 *   and a kebab-case suffix (e.g., `0628-add-auth`)
 *
 * Both forms:
 * - Contain only lowercase letters, numbers, and hyphens
 * - Do not start or end with a hyphen (the MMDD prefix's hyphen is part of the prefix)
 * - Do not contain consecutive hyphens
 *
 * @param name - The change name to validate
 * @returns Validation result with `valid: true` or `valid: false` with an error message
 *
 * @example
 * validateChangeName('add-auth')        // { valid: true }
 * validateChangeName('0628-add-auth')   // { valid: true }
 * validateChangeName('Add-Auth')        // { valid: false, error: '...' }
 */
export function validateChangeName(name: string): ValidationResult {
  // Pattern: two accepted forms.
  //   Form 1 (classic): ^[a-z][a-z0-9]*(-[a-z0-9]+)*$
  //   Form 2 (MMDD-prefixed): ^\d{4}-[a-z][a-z0-9]*(-[a-z0-9]+)*$
  const kebabCasePattern = /^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|\d{4}-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;

  if (!name) {
    return { valid: false, error: 'Change name cannot be empty' };
  }

  if (!kebabCasePattern.test(name)) {
    // Provide specific error messages for common mistakes
    if (/[A-Z]/.test(name)) {
      return { valid: false, error: 'Change name must be lowercase (use kebab-case)' };
    }
    if (/\s/.test(name)) {
      return { valid: false, error: 'Change name cannot contain spaces (use hyphens instead)' };
    }
    if (/_/.test(name)) {
      return { valid: false, error: 'Change name cannot contain underscores (use hyphens instead)' };
    }
    if (name.startsWith('-')) {
      return { valid: false, error: 'Change name cannot start with a hyphen' };
    }
    if (name.endsWith('-')) {
      return { valid: false, error: 'Change name cannot end with a hyphen' };
    }
    if (/--/.test(name)) {
      return { valid: false, error: 'Change name cannot contain consecutive hyphens' };
    }
    if (/[^a-z0-9-]/.test(name)) {
      return { valid: false, error: 'Change name can only contain lowercase letters, numbers, and hyphens' };
    }
    // Numeric-prefixed name that didn't match Form 2: diagnose the date prefix shape
    if (/^\d/.test(name)) {
      if (!/^\d{4}-[a-z]/.test(name)) {
        return { valid: false, error: 'Numeric-prefixed change name must use MMDD-<kebab> form (e.g., 0628-add-auth)' };
      }
      return { valid: false, error: 'Change name with MMDD prefix must be followed by kebab-case (e.g., 0628-add-auth)' };
    }

    return { valid: false, error: 'Change name must follow kebab-case convention (e.g., add-auth, 0628-add-auth)' };
  }

  return { valid: true };
}

/**
 * Creates a new change directory with metadata file.
 *
 * @param projectRoot - The root directory of the project (where `openspec/` lives)
 * @param name - The change name (must be valid kebab-case)
 * @param options - Optional settings for the change
 * @throws Error if the change name is invalid
 * @throws Error if the schema name is invalid
 * @throws Error if the change directory already exists
 *
 * @returns Result containing the resolved schema name
 *
 * @example
 * // Creates openspec/changes/add-auth/ with default schema
 * const result = await createChange('/path/to/project', 'add-auth')
 * console.log(result.schema) // 'spec-driven' or value from config
 *
 * @example
 * // Creates openspec/changes/add-auth/ with custom schema
 * const result = await createChange('/path/to/project', 'add-auth', { schema: 'my-workflow' })
 * console.log(result.schema) // 'my-workflow'
 */
export async function createChange(
  projectRoot: string,
  name: string,
  options: CreateChangeOptions = {}
): Promise<CreateChangeResult> {
  // Validate the name first
  const validation = validateChangeName(name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const defaultSchema = options.defaultSchema ?? DEFAULT_SCHEMA;

  // Determine schema: explicit option → project config → supplied default
  let schemaName: string;
  if (options.schema) {
    schemaName = options.schema;
  } else {
    // Try to read from project config
    try {
      const config = readProjectConfig(projectRoot);
      schemaName = config?.schema ?? defaultSchema;
    } catch {
      // If config read fails, use default
      schemaName = defaultSchema;
    }
  }

  // Validate the resolved schema
  validateSchemaName(schemaName, projectRoot);

  // Build the change directory path
  const changeDir = path.join(options.changesDir ?? path.join(projectRoot, 'openspec', 'changes'), name);

  // Check if change already exists
  if (await FileSystemUtils.directoryExists(changeDir)) {
    throw new Error(`Change '${name}' already exists at ${changeDir}`);
  }

  // Create the directory (including parent directories if needed)
  await FileSystemUtils.createDirectory(changeDir);

  // Write metadata file with schema and creation date
  const today = new Date().toISOString().split('T')[0];
  writeChangeMetadata(changeDir, {
    schema: schemaName,
    created: today,
    ...options.metadata,
  }, projectRoot);

  return { schema: schemaName, changeDir };
}
