import { Editor, Notice } from "obsidian";
import { SearchMatcher } from "./search/SearchMatcher";
import { DEFAULT_SEARCH_OPTIONS } from "./state";

export interface RegexRule {
  name: string;
  query: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface RegexPreset {
  id: string;
  name: string;
  rules: RegexRule[];
}

export interface RegexPresetPipeline {
  id: string;
  name: string;
  presetIds: string[];
}

export const newRule = (name = "New rule"): RegexRule => ({
  name,
  query: "",
  replace: "",
  caseSensitive: false,
  wholeWord: false,
});

export const newPreset = (): RegexPreset => ({
  id: crypto.randomUUID(),
  name: "New preset",
  rules: [newRule("Rule 1")],
});

/** Apply every rule in order as one editor change, scoped to the selection if present. */
function applyRules(
  editor: Editor,
  rules: RegexRule[],
  sourceName: string,
): void {
  const selection = editor.getSelection();
  let text = selection || editor.getValue();
  const matcher = new SearchMatcher();
  for (const rule of rules) {
    if (!rule.query) continue;
    matcher.updateRegex(rule.query, {
      ...DEFAULT_SEARCH_OPTIONS,
      caseSensitive: rule.caseSensitive,
      wholeWord: rule.wholeWord,
    });
    if (!matcher.isValid()) {
      new Notice(
        `Invalid regex in ${sourceName} / ${rule.name}: ${rule.query}`,
      );
      return;
    }
    text = matcher.replaceMatches(text, rule.replace);
  }
  if (selection) {
    if (text !== selection) editor.replaceSelection(text);
  } else if (text !== editor.getValue()) {
    const lastLine = editor.lastLine();
    editor.replaceRange(
      text,
      { line: 0, ch: 0 },
      {
        line: lastLine,
        ch: editor.getLine(lastLine).length,
      },
    );
  }
}

export function applyPreset(editor: Editor, preset: RegexPreset): void {
  applyRules(editor, preset.rules, preset.name);
}

export function applyPresetPipeline(
  editor: Editor,
  pipeline: RegexPresetPipeline,
  presets: RegexPreset[],
): void {
  const byId = new Map(presets.map((preset) => [preset.id, preset]));
  const rules = pipeline.presetIds.flatMap(
    (presetId) => byId.get(presetId)?.rules ?? [],
  );
  applyRules(editor, rules, pipeline.name);
}
