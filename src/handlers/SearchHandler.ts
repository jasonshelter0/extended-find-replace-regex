import { EditorView } from "@codemirror/view";
import { App } from "obsidian";
import { SearchMatcher } from "../search/SearchMatcher";
import { SearchInput } from "../ui/SearchInput";
import { BaseSearchInput } from "../ui/BaseSearchInput";
import {
  getSearchQuery,
  getReplaceQuery,
  getSearchOptions,
  getSearchScope,
  getMatchIndex,
  setMatchIndex,
} from "../state";
import { SearchAndReplaceRegexSettings } from "../settings";

export class SearchHandler {
  constructor(
    private view: EditorView,
    private app: App,
    private settings: SearchAndReplaceRegexSettings,
    private matcher: SearchMatcher,
    private searchInput?: SearchInput,
    private replaceInput?: BaseSearchInput,
  ) {}

  private getMatches() {
    const query = getSearchQuery(this.view.state);
    const options = getSearchOptions(this.view.state);
    if (!query) return null;

    this.matcher.updateRegex(query, options);
    if (!this.matcher.isValid()) return null;

    if (options.selectionOnly) {
      const scope = getSearchScope(this.view.state);
      if (!scope) return null;
      const selectedText = this.view.state.doc.sliceString(
        scope.from,
        scope.to,
      );
      const matches = this.matcher.findMatches(selectedText);
      return {
        text: selectedText,
        matches: matches.map((m) => ({
          ...m,
          start: m.start + scope.from,
          end: m.end + scope.from,
        })),
        selectionRange: scope,
      };
    }

    const text = this.view.state.doc.toString();
    return { text, matches: this.matcher.findMatches(text) };
  }

  navigate(direction: number) {
    const data = this.getMatches();
    if (!data || data.matches.length === 0) return;

    const currentIndex = getMatchIndex(this.view.state);
    const newIndex =
      (currentIndex + direction + data.matches.length) % data.matches.length;
    const targetMatch = data.matches[newIndex];
    if (!targetMatch) return;

    this.view.dispatch({
      selection: { anchor: targetMatch.start, head: targetMatch.end },
      effects: [
        EditorView.scrollIntoView(targetMatch.start, { y: "center" }),
        setMatchIndex.of(newIndex),
      ],
    });

    // In selection-only mode, keep the selection range visible for context
    if (data.selectionRange) {
      this.view.dispatch({
        effects: [
          EditorView.scrollIntoView(data.selectionRange.from, {
            y: "center",
          }),
        ],
      });
    }
  }

  async replace(all = false) {
    const data = this.getMatches();
    if (!data || data.matches.length === 0) return;

    const replaceText = getReplaceQuery(this.view.state);
    let newText: string;
    let replaced = false;

    if (all) {
      newText = this.matcher.replaceMatches(data.text, replaceText);
      replaced = true;
    } else {
      const res = this.matcher.replaceSingleMatch(
        data.text,
        replaceText,
        getMatchIndex(this.view.state),
      );
      newText = res.result;
      replaced = res.replaced;
    }

    if (replaced) {
      // Keep the editor transaction to the actual changed span. Replacing
      // the whole note for one hit rebuilds unrelated Live Preview widgets.
      const oldText = data.text;
      let from = 0;
      while (
        from < oldText.length &&
        from < newText.length &&
        oldText[from] === newText[from]
      )
        from++;
      let oldEnd = oldText.length;
      let newEnd = newText.length;
      while (
        oldEnd > from &&
        newEnd > from &&
        oldText[oldEnd - 1] === newText[newEnd - 1]
      ) {
        oldEnd--;
        newEnd--;
      }
      if (from !== oldEnd || from !== newEnd) {
        const offset = data.selectionRange?.from ?? 0;
        this.view.dispatch({
          changes: {
            from: offset + from,
            to: offset + oldEnd,
            insert: newText.slice(from, newEnd),
          },
        });
      }
      if (!all) {
        const move =
          (this.getMatches()?.matches.length || 0) - data.matches.length + 1;
        this.navigate(move);
      }
    }
  }

  updateSearchCount() {
    if (!this.searchInput) return;
    const data = this.getMatches();
    const count = data ? data.matches.length : 0;
    const current = count > 0 ? getMatchIndex(this.view.state) : 0;
    this.searchInput.updateSearchCount(current, count);
  }
}
