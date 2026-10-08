import { App, SuggestModal } from "obsidian";
import { RegexPreset } from "../presets";

export class PresetModal extends SuggestModal<RegexPreset> {
  constructor(
    app: App,
    private presets: RegexPreset[],
    private onSelect: (preset: RegexPreset) => void,
  ) {
    super(app);
    this.setPlaceholder("Choose a regex preset...");
  }

  getSuggestions(query: string): RegexPreset[] {
    const needle = query.toLowerCase();
    return this.presets.filter((preset) =>
      preset.name.toLowerCase().includes(needle),
    );
  }

  renderSuggestion(preset: RegexPreset, el: HTMLElement): void {
    el.createDiv({ text: preset.name });
    el.createEl("small", { text: `${preset.rules.length} rule(s)` });
  }

  onChooseSuggestion(preset: RegexPreset): void {
    this.onSelect(preset);
  }
}
