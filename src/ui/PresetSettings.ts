import { Modal, Notice, Setting } from "obsidian";
import { ToggleButtonComponent } from "./components";
import type SearchAndReplaceRegex from "../main";
import { newPreset, newRule, RegexPresetPipeline } from "../presets";
import {
  createPresetTransferFile,
  parsePresetTransferFile,
} from "../presetTransfer";

const newPipeline = (): RegexPresetPipeline => ({
  id: crypto.randomUUID(),
  name: "New pipeline",
  presetIds: [],
});

const foldedCards = new Map<string, boolean>();

class RenameModal extends Modal {
  constructor(
    app: SearchAndReplaceRegex["app"],
    private itemType: string,
    private currentName: string,
    private onSave: (name: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(`Rename ${this.itemType}`);
    let name = this.currentName;
    new Setting(this.contentEl).setName("Name").addText((text) => {
      text.setValue(name).onChange((value) => (name = value));
      text.inputEl.focus();
      text.inputEl.select();
    });
    new Setting(this.contentEl)
      .addButton((button) =>
        button
          .setButtonText("Save")
          .setCta()
          .onClick(() => {
            this.onSave(name);
            this.close();
          }),
      )
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => this.close()),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function enableNamePrompt(
  element: HTMLElement,
  plugin: SearchAndReplaceRegex,
  itemType: string,
  getName: () => string,
  onSave: (name: string) => Promise<void>,
  updateTitle?: (name: string) => void,
): void {
  element.addClass("regex-preset-name");
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  element.setAttribute("title", `Rename ${itemType}`);
  const open = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    new RenameModal(plugin.app, itemType, getName(), (name) => {
      void onSave(name);
      updateTitle?.(name);
    }).open();
  };
  element.addEventListener("click", open);
  element.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") open(event);
  });
}

function createFoldableCard(
  containerEl: HTMLElement,
  id: string,
  title: string,
): {
  card: HTMLDivElement;
  header: Setting;
  titleEl: HTMLElement;
  contentEl: HTMLDivElement;
} {
  const card = containerEl.createDiv("regex-preset-card");
  const header = new Setting(card).setName(title);
  const titleEl = header.nameEl;
  const contentEl = card.createDiv("regex-preset-content");
  const folded = foldedCards.get(id) === true;
  contentEl.hidden = folded;
  header.addExtraButton((button) => {
    button
      .setIcon(folded ? "chevron-right" : "chevron-down")
      .setTooltip(folded ? "Expand" : "Collapse")
      .onClick(() => {
        const nextFolded = !contentEl.hidden;
        contentEl.hidden = nextFolded;
        foldedCards.set(id, nextFolded);
        button
          .setIcon(nextFolded ? "chevron-right" : "chevron-down")
          .setTooltip(nextFolded ? "Expand" : "Collapse");
      });
  });
  return { card, header, titleEl, contentEl };
}

export function renderRegexPresetSettings(
  containerEl: HTMLElement,
  plugin: SearchAndReplaceRegex,
  redraw: () => void,
): void {
  const { settings } = plugin;
  new Setting(containerEl).setHeading().setName("Regex presets");
  new Setting(containerEl)
    .setDesc(
      "Save presets here or export them to move presets and pipelines to another vault.",
    )
    .addButton((button) =>
      button.setButtonText("Add preset").onClick(async () => {
        settings.presets.push(newPreset());
        await plugin.saveSettings();
        redraw();
      }),
    )
    .addButton((button) =>
      button
        .setButtonText("Export")
        .onClick(() => exportPresets(containerEl, plugin)),
    )
    .addButton((button) =>
      button.setButtonText("Import").onClick(() => importInput.click()),
    );

  const importInput = containerEl.createEl("input", {
    attr: { type: "file", accept: ".json,application/json" },
  });
  importInput.hidden = true;
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (file) void importPresets(file, plugin, redraw);
  });

  for (const preset of settings.presets) {
    const {
      header,
      titleEl,
      contentEl: presetEl,
    } = createFoldableCard(
      containerEl,
      `preset:${preset.id}`,
      preset.name || "Untitled preset",
    );
    enableNamePrompt(
      titleEl,
      plugin,
      "preset",
      () => preset.name,
      async (name) => {
        preset.name = name;
        await plugin.saveSettings();
      },
      (name) => titleEl.setText(name || "Untitled preset"),
    );
    header
      .addButton((button) =>
        button.setButtonText("Add rule").onClick(async () => {
          preset.rules.push(newRule(`Rule ${preset.rules.length + 1}`));
          await plugin.saveSettings();
          redraw();
        }),
      )
      .addExtraButton((button) =>
        button
          .setIcon("trash")
          .setTooltip("Delete preset")
          .onClick(async () => {
            settings.presets = settings.presets.filter(
              (item) => item.id !== preset.id,
            );
            for (const pipeline of settings.presetPipelines) {
              pipeline.presetIds = pipeline.presetIds.filter(
                (id) => id !== preset.id,
              );
            }
            await plugin.saveSettings();
            redraw();
          }),
      );

    preset.rules.forEach((rule, index) => {
      const ruleEl = presetEl.createDiv("regex-preset-rule");
      const ruleNameSetting = new Setting(ruleEl).setName(
        rule.name || `Rule ${index + 1}`,
      );
      enableNamePrompt(
        ruleNameSetting.nameEl,
        plugin,
        "rule",
        () => rule.name,
        async (name) => {
          rule.name = name;
          await plugin.saveSettings();
        },
        (name) => {
          ruleNameSetting.setName(name || `Rule ${index + 1}`);
        },
      );
      ruleNameSetting
        .addExtraButton((button) =>
          button
            .setIcon("arrow-up")
            .setTooltip("Move rule up")
            .setDisabled(index === 0)
            .onClick(async () => {
              [preset.rules[index - 1], preset.rules[index]] = [
                preset.rules[index],
                preset.rules[index - 1],
              ];
              await plugin.saveSettings();
              redraw();
            }),
        )
        .addExtraButton((button) =>
          button
            .setIcon("arrow-down")
            .setTooltip("Move rule down")
            .setDisabled(index === preset.rules.length - 1)
            .onClick(async () => {
              [preset.rules[index + 1], preset.rules[index]] = [
                preset.rules[index],
                preset.rules[index + 1],
              ];
              await plugin.saveSettings();
              redraw();
            }),
        )
        .addExtraButton((button) =>
          button
            .setIcon("trash")
            .setTooltip("Delete rule")
            .onClick(async () => {
              preset.rules.splice(index, 1);
              await plugin.saveSettings();
              redraw();
            }),
        );
      const searchSetting = new Setting(ruleEl)
        .setName("Search")
        .addText((text) =>
          text
            .setPlaceholder("Regex pattern")
            .setValue(rule.query)
            .onChange(async (value) => {
              rule.query = value;
              await plugin.saveSettings();
            }),
        );
      const searchToggles = searchSetting.controlEl.createDiv(
        "document-search-buttons",
      );
      new ToggleButtonComponent(searchToggles)
        .setIcon("case-sensitive")
        .setTooltip("Case sensitive")
        .setValue(rule.caseSensitive)
        .onChange((value) => {
          rule.caseSensitive = value;
          void plugin.saveSettings();
        });
      new ToggleButtonComponent(searchToggles)
        .setIcon("whole-word")
        .setTooltip("Whole word")
        .setValue(rule.wholeWord)
        .onChange((value) => {
          rule.wholeWord = value;
          void plugin.saveSettings();
        });
      new Setting(ruleEl).setName("Replace").addText((text) =>
        text
          .setPlaceholder("Replacement; blank removes matches")
          .setValue(rule.replace)
          .onChange(async (value) => {
            rule.replace = value;
            await plugin.saveSettings();
          }),
      );
    });
  }

  renderPipelines(containerEl, plugin, redraw);
}

function renderPipelines(
  containerEl: HTMLElement,
  plugin: SearchAndReplaceRegex,
  redraw: () => void,
): void {
  const { settings } = plugin;
  new Setting(containerEl).setHeading().setName("Preset pipelines");
  new Setting(containerEl)
    .setDesc("Apply several presets in order as one replacement action.")
    .addButton((button) =>
      button.setButtonText("Add pipeline").onClick(async () => {
        settings.presetPipelines.push(newPipeline());
        await plugin.saveSettings();
        redraw();
      }),
    );

  for (const pipeline of settings.presetPipelines) {
    const {
      header,
      titleEl,
      contentEl: pipelineEl,
    } = createFoldableCard(
      containerEl,
      `pipeline:${pipeline.id}`,
      pipeline.name || "Untitled pipeline",
    );
    enableNamePrompt(
      titleEl,
      plugin,
      "pipeline",
      () => pipeline.name,
      async (name) => {
        pipeline.name = name;
        await plugin.saveSettings();
      },
      (name) => titleEl.setText(name || "Untitled pipeline"),
    );
    header.addExtraButton((button) =>
      button
        .setIcon("trash")
        .setTooltip("Delete pipeline")
        .onClick(async () => {
          settings.presetPipelines = settings.presetPipelines.filter(
            (item) => item.id !== pipeline.id,
          );
          await plugin.saveSettings();
          redraw();
        }),
    );

    pipeline.presetIds.forEach((presetId, index) => {
      const preset = settings.presets.find((item) => item.id === presetId);
      new Setting(pipelineEl)
        .setName(`Step ${index + 1}`)
        .setDesc(preset?.name ?? "Missing preset")
        .addExtraButton((button) =>
          button
            .setIcon("arrow-up")
            .setTooltip("Move up")
            .setDisabled(index === 0)
            .onClick(async () => {
              [pipeline.presetIds[index - 1], pipeline.presetIds[index]] = [
                pipeline.presetIds[index],
                pipeline.presetIds[index - 1],
              ];
              await plugin.saveSettings();
              redraw();
            }),
        )
        .addExtraButton((button) =>
          button
            .setIcon("arrow-down")
            .setTooltip("Move down")
            .setDisabled(index === pipeline.presetIds.length - 1)
            .onClick(async () => {
              [pipeline.presetIds[index + 1], pipeline.presetIds[index]] = [
                pipeline.presetIds[index],
                pipeline.presetIds[index + 1],
              ];
              await plugin.saveSettings();
              redraw();
            }),
        )
        .addExtraButton((button) =>
          button
            .setIcon("trash")
            .setTooltip("Remove preset from pipeline")
            .onClick(async () => {
              pipeline.presetIds.splice(index, 1);
              await plugin.saveSettings();
              redraw();
            }),
        );
    });

    const options = Object.fromEntries(
      settings.presets.map((preset) => [preset.id, preset.name]),
    );
    new Setting(pipelineEl).setName("Add preset").addDropdown((dropdown) =>
      dropdown
        .addOption("", "Choose a preset")
        .addOptions(options)
        .setValue("")
        .onChange(async (id) => {
          if (!id) return;
          pipeline.presetIds.push(id);
          await plugin.saveSettings();
          redraw();
        }),
    );
  }
}

function exportPresets(
  containerEl: HTMLElement,
  plugin: SearchAndReplaceRegex,
): void {
  const win = containerEl.ownerDocument.defaultView;
  if (!win) return;
  const contents = createPresetTransferFile(
    plugin.settings.presets,
    plugin.settings.presetPipelines,
  );
  const url = win.URL.createObjectURL(
    new win.Blob([JSON.stringify(contents, null, 2)], {
      type: "application/json",
    }),
  );
  const link = containerEl.ownerDocument.createElement("a");
  link.href = url;
  link.download = "regex-presets.json";
  link.click();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  new Notice("Presets and pipelines exported.");
}

async function importPresets(
  file: File,
  plugin: SearchAndReplaceRegex,
  redraw: () => void,
): Promise<void> {
  try {
    const value: unknown = JSON.parse(await file.text());
    const imported = parsePresetTransferFile(
      value,
      plugin.settings.presets,
      plugin.settings.presetPipelines,
    );
    if (!imported) {
      new Notice("Invalid preset file.");
      return;
    }
    plugin.settings.presets.push(...imported.presets);
    plugin.settings.presetPipelines.push(...imported.pipelines);
    await plugin.saveSettings();
    redraw();
    new Notice(
      `Imported ${imported.presets.length} preset(s) and ${imported.pipelines.length} pipeline(s).`,
    );
  } catch {
    new Notice("Could not read preset file.");
  }
}
