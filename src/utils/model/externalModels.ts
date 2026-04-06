/**
 * External model configuration loader.
 *
 * Reads config/models.json at startup so operators can add, remove, or
 * reorder models without touching source code or rebuilding.
 *
 * The file is resolved relative to the package root (two levels above
 * this module's compiled location in dist/utils/model/).  A missing or
 * malformed file is silently ignored — the built-in model list takes over.
 */

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { logForDebugging } from '../debug.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExternalModelEntry {
  id: string
  displayName: string
  contextWindow: number
  maxOutputTokens: number
  supportsTools: boolean
  supportsVision: boolean
  aliases?: string[]
}

export interface ExternalModelsConfig {
  defaultModel?: string
  smallFastModel?: string
  models: ExternalModelEntry[]
}

// ---------------------------------------------------------------------------
// Singleton cache
// ---------------------------------------------------------------------------

let _config: ExternalModelsConfig | null = null
let _loaded = false

/**
 * Try to load config/models.json once.  Subsequent calls return the
 * cached result (which may be null if the file was missing / invalid).
 */
export function getExternalModelsConfig(): ExternalModelsConfig | null {
  if (_loaded) return _config

  _loaded = true

  // Resolve config path - check multiple locations:
  // 1. LAIAI_MODELS_CONFIG env var (absolute path)
  // 2. config/models.json relative to package root
  const candidates: string[] = []

  if (process.env.LAIAI_MODELS_CONFIG) {
    candidates.push(process.env.LAIAI_MODELS_CONFIG)
  }

  // Package root: walk up from this file's directory
  try {
    const thisDir = dirname(fileURLToPath(import.meta.url))
    // In source: src/utils/model/ -> root is ../../..
    // In dist:   dist/utils/model/ -> root is ../../..
    candidates.push(resolve(thisDir, '..', '..', '..', 'config', 'models.json'))
  } catch {
    // import.meta.url may not resolve in all bundlers
  }

  // Also try CWD-relative
  candidates.push(resolve(process.cwd(), 'config', 'models.json'))

  for (const configPath of candidates) {
    try {
      const raw = readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw) as ExternalModelsConfig

      if (!Array.isArray(parsed.models) || parsed.models.length === 0) {
        logForDebugging(
          `[externalModels] ${configPath} has no models array, skipping`,
        )
        continue
      }

      _config = parsed
      logForDebugging(
        `[externalModels] Loaded ${parsed.models.length} models from ${configPath}`,
      )
      return _config
    } catch {
      // File not found or malformed — try next candidate
    }
  }

  logForDebugging('[externalModels] No external models config found, using built-in defaults')
  return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up an external model by its id or any of its aliases. */
export function findExternalModel(
  nameOrAlias: string,
): ExternalModelEntry | undefined {
  const cfg = getExternalModelsConfig()
  if (!cfg) return undefined

  const lower = nameOrAlias.toLowerCase()
  return cfg.models.find(
    m =>
      m.id.toLowerCase() === lower ||
      m.aliases?.some(a => a.toLowerCase() === lower),
  )
}

/** Get the default model from external config, if configured. */
export function getExternalDefaultModel(): string | undefined {
  return getExternalModelsConfig()?.defaultModel
}

/** Get the small/fast model from external config, if configured. */
export function getExternalSmallFastModel(): string | undefined {
  return getExternalModelsConfig()?.smallFastModel
}

/** Get display name for a model from external config. */
export function getExternalModelDisplayName(
  modelId: string,
): string | null {
  const m = findExternalModel(modelId)
  return m?.displayName ?? null
}

/** Get context window for a model from external config. */
export function getExternalModelContextWindow(
  modelId: string,
): number | null {
  const m = findExternalModel(modelId)
  return m?.contextWindow ?? null
}

/** Get max output tokens for a model from external config. */
export function getExternalModelMaxOutputTokens(
  modelId: string,
): number | null {
  const m = findExternalModel(modelId)
  return m?.maxOutputTokens ?? null
}

/** Get all model IDs from external config. */
export function getExternalModelIds(): string[] {
  const cfg = getExternalModelsConfig()
  if (!cfg) return []
  return cfg.models.map(m => m.id)
}

/** Get all alias→id mappings from external config. */
export function getExternalAliasMap(): Map<string, string> {
  const cfg = getExternalModelsConfig()
  const map = new Map<string, string>()
  if (!cfg) return map
  for (const m of cfg.models) {
    if (m.aliases) {
      for (const alias of m.aliases) {
        map.set(alias.toLowerCase(), m.id)
      }
    }
  }
  return map
}
