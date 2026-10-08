import { StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Editor } from "obsidian";
import type SearchAndReplaceRegex from "./main";
import { SearchHandler } from "./handlers/SearchHandler";
import { SearchMatcher } from "./search/SearchMatcher";
import {
  applyPreset,
  applyPresetPipeline,
  RegexPreset,
  RegexPresetPipeline,
} from "./presets";
import { PresetModal } from "./ui/PresetModal";
import { PresetPipelineModal } from "./ui/PresetPipelineModal";
import {
  focusSearchInput,
  setMatchIndex,
  setReplaceQuery,
  setSearchOptions,
  setSearchQuery,
  setSearchScope,
  toggleReplaceMode,
  toggleSearchPanel,
} from "./state";

type EditorWithCodeMirror = Editor & {
  cm?: EditorView;
};

const dispatchEffects = (editor: Editor, effects: StateEffect<unknown>[]) => {
  (editor as EditorWithCodeMirror).cm?.dispatch({ effects });
};

const matcher = new SearchMatcher();

export function showPresetSearch(
  plugin: SearchAndReplaceRegex,
  editor: Editor,
) {
  const view = (editor as EditorWithCodeMirror).cm;
  if (!view) return;
  new PresetModal(plugin.app, plugin.settings.presets, (preset) => {
    const rule = preset.rules[0];
    if (!rule) return;
    view.dispatch({
      effects: [
        setSearchQuery.of(rule.query),
        setReplaceQuery.of(rule.replace),
        setSearchOptions.of({
          caseSensitive: rule.caseSensitive,
          wholeWord: rule.wholeWord,
          useRegex: true,
          selectionOnly: false,
        }),
        setMatchIndex.of(0),
        setSearchScope.of(null),
        toggleSearchPanel.of(true),
        toggleReplaceMode.of(false),
        focusSearchInput.of(),
      ],
    });
  }).open();
}

export function showPresetApply(plugin: SearchAndReplaceRegex, editor: Editor) {
  new PresetModal(plugin.app, plugin.settings.presets, (preset) =>
    applyPreset(editor, preset),
  ).open();
}

export function registerPresetCommands(
  plugin: SearchAndReplaceRegex,
  preset: RegexPreset,
) {
  plugin.addCommand({
    id: `apply-preset-${preset.id}`,
    name: `Apply preset: ${preset.name}`,
    editorCallback: (editor) => applyPreset(editor, preset),
  });
}

export function showPresetPipelineApply(
  plugin: SearchAndReplaceRegex,
  editor: Editor,
): void {
  new PresetPipelineModal(
    plugin.app,
    plugin.settings.presetPipelines,
    (pipeline) =>
      applyPresetPipeline(editor, pipeline, plugin.settings.presets),
  ).open();
}

export function registerPresetPipelineCommand(
  plugin: SearchAndReplaceRegex,
  pipeline: RegexPresetPipeline,
): void {
  plugin.addCommand({
    id: `apply-preset-pipeline-${pipeline.id}`,
    name: `Apply preset pipeline: ${pipeline.name}`,
    editorCallback: (editor) =>
      applyPresetPipeline(editor, pipeline, plugin.settings.presets),
  });
}

export function registerCommands(plugin: SearchAndReplaceRegex) {
  plugin.addCommand({
    id: "choose-regex-preset",
    name: "Search with regex preset",
    editorCallback: (editor) => showPresetSearch(plugin, editor),
  });
  plugin.addCommand({
    id: "apply-regex-preset",
    name: "Apply regex preset",
    editorCallback: (editor) => showPresetApply(plugin, editor),
  });
  plugin.addCommand({
    id: "apply-regex-preset-pipeline",
    name: "Apply regex preset pipeline",
    editorCallback: (editor) => showPresetPipelineApply(plugin, editor),
  });
  plugin.addCommand({
    id: "open-regex-search",
    name: "Search",
    editorCallback: (editor: Editor) =>
      dispatchEffects(editor, [
        toggleSearchPanel.of(true),
        toggleReplaceMode.of(false),
        focusSearchInput.of(),
      ]),
  });

  plugin.addCommand({
    id: "open-regex-replace",
    name: "Replace",
    editorCallback: (editor: Editor) =>
      dispatchEffects(editor, [
        toggleSearchPanel.of(true),
        toggleReplaceMode.of(true),
        focusSearchInput.of(),
      ]),
  });

  plugin.addCommand({
    id: "search-next",
    name: "Search next match",
    editorCallback: (editor: Editor) => {
      const view = (editor as EditorWithCodeMirror).cm;
      if (view)
        new SearchHandler(view, plugin.app, plugin.settings, matcher).navigate(
          1,
        );
    },
  });

  plugin.addCommand({
    id: "search-previous",
    name: "Search previous match",
    editorCallback: (editor: Editor) => {
      const view = (editor as EditorWithCodeMirror).cm;
      if (view)
        new SearchHandler(view, plugin.app, plugin.settings, matcher).navigate(
          -1,
        );
    },
  });
}
