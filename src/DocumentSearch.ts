import { Range } from "@codemirror/state";
import { SearchMatcher } from "./search/SearchMatcher";
import {
  Decoration,
  DecorationSet,
  EditorView,
  Panel,
  PluginValue,
  showPanel,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import {
  getMatchIndex,
  getSearchOptions,
  getSearchQuery,
  getSearchScope,
  isSearchPanelOpen,
  matchIndexField,
  replaceModeField,
  replaceQueryField,
  searchOptionsField,
  searchPanelOpenField,
  searchQueryField,
  searchScopeField,
  setMatchIndex,
  setSearchOptions,
  setSearchQuery,
  setSearchScope,
  toggleSearchPanel,
} from "./state";
import SearchAndReplaceRegex from "./main";
import { App } from "obsidian";
import { SearchPanel } from "./ui/SearchPanel";

class DocumentSearch implements PluginValue {
  decorations: DecorationSet;
  private matcher: SearchMatcher = new SearchMatcher();

  constructor(view: EditorView) {
    this.decorations = this.computeDecorations(view);
  }

  update(update: ViewUpdate) {
    const selectionOnly = getSearchOptions(update.view.state).selectionOnly;
    const changed =
      update.docChanged ||
      (selectionOnly && update.selectionSet) ||
      update.transactions.some((tr) =>
        tr.effects.some(
          (e) =>
            e.is(setSearchQuery) ||
            e.is(setSearchOptions) ||
            e.is(setSearchScope) ||
            e.is(setMatchIndex) ||
            e.is(toggleSearchPanel),
        ),
      );

    if (changed) this.decorations = this.computeDecorations(update.view);
  }

  computeDecorations(view: EditorView): DecorationSet {
    if (!isSearchPanelOpen(view.state)) return Decoration.none;

    const options = getSearchOptions(view.state);
    const builder: Range<Decoration>[] = [];

    // In selection-only mode, highlight the search scope so it stays visible
    // even when the editor loses focus to the search input.
    if (options.selectionOnly) {
      const scope = getSearchScope(view.state);
      if (scope) {
        builder.push(
          Decoration.mark({
            class: "document-search-selection-range",
          }).range(scope.from, scope.to),
        );
      }
    }

    const query = getSearchQuery(view.state);
    if (!query) return Decoration.set(builder, true);

    this.matcher.updateRegex(query, options);
    if (!this.matcher.isValid()) return Decoration.set(builder, true);

    const currentIndex = getMatchIndex(view.state);

    let matches;
    if (options.selectionOnly) {
      const scope = getSearchScope(view.state);
      if (!scope) return Decoration.set(builder, true);
      const selectedText = view.state.doc.sliceString(
        scope.from,
        scope.to,
      );
      matches = this.matcher
        .findMatches(selectedText)
        .map((m) => ({
          ...m,
          start: m.start + scope.from,
          end: m.end + scope.from,
        }));
    } else {
      matches = this.matcher.findMatches(view.state.doc.toString());
    }

    matches.forEach((match, index) => {
      builder.push(
        Decoration.mark({
          class:
            index === currentIndex
              ? "document-search-match-current"
              : "document-search-match",
        }).range(match.start, match.end),
      );
    });

    return Decoration.set(builder, true);
  }
}

export function createSearchExtension(app: App, plugin: SearchAndReplaceRegex) {
  return [
    searchQueryField,
    replaceQueryField,
    searchOptionsField,
    searchPanelOpenField,
    replaceModeField,
    matchIndexField,
    searchScopeField,
    showPanel.from(searchPanelOpenField, (val) =>
      val ? (view: EditorView) => createSearchPanel(view, app, plugin) : null,
    ),
    ViewPlugin.fromClass(DocumentSearch, { decorations: (v) => v.decorations }),
  ];
}

export function createSearchPanel(
  view: EditorView,
  app: App,
  plugin: SearchAndReplaceRegex,
): Panel {
  const searchPanel = new SearchPanel(view, app, plugin.settings, () =>
    plugin.saveSettings(),
  );
  const panelDom = searchPanel.dom;

  view.dom.parentElement?.prepend(panelDom);
  window.requestAnimationFrame(() => searchPanel.focus());

  return searchPanel.createPanel();
}
