import { Plugin } from "obsidian";
import { createSearchExtension } from "./DocumentSearch";
import {
  registerCommands,
  registerPresetCommands,
  registerPresetPipelineCommand,
} from "./commands";
import { registerEditorMenu } from "./editorMenu";
import {
  DEFAULT_SETTINGS,
  SearchAndReplaceRegexSettings,
  SearchAndReplaceRegexSettingTab,
} from "./settings";

export default class SearchAndReplaceRegex extends Plugin {
  settings!: SearchAndReplaceRegexSettings;
  private presetCommands = new Map<string, string>();
  private pipelineCommands = new Map<string, string>();

  async onload() {
    await this.loadSettings();

    this.registerEditorExtension(createSearchExtension(this.app, this));

    registerCommands(this);
    this.refreshPresetCommands();
    registerEditorMenu(this);

    this.addSettingTab(new SearchAndReplaceRegexSettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<SearchAndReplaceRegexSettings>,
    );
    this.settings.defaultSearchOptions = {
      ...DEFAULT_SETTINGS.defaultSearchOptions,
      ...this.settings.defaultSearchOptions,
    };
    if (!Array.isArray(this.settings.presets)) this.settings.presets = [];
    this.settings.presets = this.settings.presets.map((preset) => ({
      ...preset,
      rules: (Array.isArray(preset.rules) ? preset.rules : []).map(
        (rule, index) => ({
          ...rule,
          name:
            typeof rule.name === "string" && rule.name.length > 0
              ? rule.name
              : `Rule ${index + 1}`,
        }),
      ),
    }));
    if (!Array.isArray(this.settings.presetPipelines))
      this.settings.presetPipelines = [];
    this.settings.presetPipelines = this.settings.presetPipelines.map(
      (pipeline) => ({
        ...pipeline,
        presetIds: Array.isArray(pipeline.presetIds)
          ? pipeline.presetIds.filter((id) => typeof id === "string")
          : [],
      }),
    );
    if (!Array.isArray(this.settings.searchHistory))
      this.settings.searchHistory = [];
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshPresetCommands();
  }

  private refreshPresetCommands() {
    const active = new Set(this.settings.presets.map((preset) => preset.id));
    for (const [id, name] of this.presetCommands) {
      if (
        !active.has(id) ||
        this.settings.presets.find((preset) => preset.id === id)?.name !== name
      ) {
        this.removeCommand(`apply-preset-${id}`);
        this.presetCommands.delete(id);
      }
    }
    for (const preset of this.settings.presets) {
      if (!this.presetCommands.has(preset.id)) {
        registerPresetCommands(this, preset);
        this.presetCommands.set(preset.id, preset.name);
      }
    }

    const activePipelines = new Set(
      this.settings.presetPipelines.map((pipeline) => pipeline.id),
    );
    for (const [id, name] of this.pipelineCommands) {
      if (
        !activePipelines.has(id) ||
        this.settings.presetPipelines.find((pipeline) => pipeline.id === id)
          ?.name !== name
      ) {
        this.removeCommand(`apply-preset-pipeline-${id}`);
        this.pipelineCommands.delete(id);
      }
    }
    for (const pipeline of this.settings.presetPipelines) {
      if (!this.pipelineCommands.has(pipeline.id)) {
        registerPresetPipelineCommand(this, pipeline);
        this.pipelineCommands.set(pipeline.id, pipeline.name);
      }
    }
  }
}
