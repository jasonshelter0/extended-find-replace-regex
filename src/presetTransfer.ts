import { RegexPreset, RegexPresetPipeline } from "./presets";

export const PRESET_TRANSFER_FORMAT = "extended-find-replace-regex-presets";

interface PresetTransferFile {
  format: typeof PRESET_TRANSFER_FORMAT;
  version: 1;
  presets: RegexPreset[];
  pipelines: RegexPresetPipeline[];
}

export function createPresetTransferFile(
  presets: RegexPreset[],
  pipelines: RegexPresetPipeline[],
): PresetTransferFile {
  return {
    format: PRESET_TRANSFER_FORMAT,
    version: 1,
    presets,
    pipelines,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate an import and remap IDs that would collide with existing data. */
export function parsePresetTransferFile(
  value: unknown,
  existingPresets: RegexPreset[],
  existingPipelines: RegexPresetPipeline[],
): Omit<PresetTransferFile, "format" | "version"> | null {
  if (
    !isRecord(value) ||
    value.format !== PRESET_TRANSFER_FORMAT ||
    value.version !== 1 ||
    !Array.isArray(value.presets) ||
    !Array.isArray(value.pipelines)
  )
    return null;

  const presets: RegexPreset[] = [];
  const presetIds = new Set(existingPresets.map((preset) => preset.id));
  const presetIdMap = new Map<string, string>();
  for (const item of value.presets) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      !Array.isArray(item.rules) ||
      presetIdMap.has(item.id)
    )
      return null;

    let id = item.id;
    if (presetIds.has(id)) id = crypto.randomUUID();
    presetIds.add(id);
    presetIdMap.set(item.id, id);

    const rules = [];
    const importedRules: unknown[] = item.rules;
    for (let index = 0; index < importedRules.length; index++) {
      const rule: unknown = importedRules[index];
      if (
        !isRecord(rule) ||
        typeof rule.query !== "string" ||
        typeof rule.replace !== "string"
      )
        return null;
      rules.push({
        name:
          typeof rule.name === "string" && rule.name.length > 0
            ? rule.name
            : `Rule ${index + 1}`,
        query: rule.query,
        replace: rule.replace,
        caseSensitive: rule.caseSensitive === true,
        wholeWord: rule.wholeWord === true,
      });
    }
    presets.push({ id, name: item.name, rules });
  }

  const pipelineIds = new Set(existingPipelines.map((pipeline) => pipeline.id));
  const pipelines: RegexPresetPipeline[] = [];
  for (const item of value.pipelines) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      !Array.isArray(item.presetIds) ||
      item.presetIds.some((id) => typeof id !== "string")
    )
      return null;
    let id = item.id;
    if (pipelineIds.has(id)) id = crypto.randomUUID();
    pipelineIds.add(id);
    pipelines.push({
      id,
      name: item.name,
      presetIds: item.presetIds
        .map((oldId) => presetIdMap.get(oldId as string))
        .filter((presetId): presetId is string => presetId !== undefined),
    });
  }

  return { presets, pipelines };
}
