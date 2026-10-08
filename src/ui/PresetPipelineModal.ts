import { App, SuggestModal } from "obsidian";
import { RegexPresetPipeline } from "../presets";

export class PresetPipelineModal extends SuggestModal<RegexPresetPipeline> {
  constructor(
    app: App,
    private pipelines: RegexPresetPipeline[],
    private onSelect: (pipeline: RegexPresetPipeline) => void,
  ) {
    super(app);
    this.setPlaceholder("Choose a preset pipeline...");
  }

  getSuggestions(query: string): RegexPresetPipeline[] {
    const needle = query.toLowerCase();
    return this.pipelines.filter((pipeline) =>
      pipeline.name.toLowerCase().includes(needle),
    );
  }

  renderSuggestion(pipeline: RegexPresetPipeline, el: HTMLElement): void {
    el.createDiv({ text: pipeline.name });
    el.createEl("small", { text: `${pipeline.presetIds.length} preset(s)` });
  }

  onChooseSuggestion(pipeline: RegexPresetPipeline): void {
    this.onSelect(pipeline);
  }
}
