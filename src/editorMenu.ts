import { EditorView } from "@codemirror/view";
import { Editor, Menu } from "obsidian";
import type SearchAndReplaceRegex from "./main";
import {
  focusSearchInput,
  getSearchOptions,
  SearchScope,
  setSearchOptions,
  setSearchScope,
  toggleReplaceMode,
  toggleSearchPanel,
} from "./state";

type EditorWithCodeMirror = Editor & {
  cm?: EditorView;
};

export function registerEditorMenu(plugin: SearchAndReplaceRegex) {
  plugin.registerEvent(
    plugin.app.workspace.on(
      "editor-menu",
      (menu: Menu, editor: Editor) => {
        const view = (editor as EditorWithCodeMirror).cm;
        if (!view) return;

        const selection = view.state.selection.main;
        if (selection.from === selection.to) return;

        // Capture the scope when the menu opens so moving the cursor before
        // clicking the item doesn't change what range gets searched.
        const scope: SearchScope = {
          from: selection.from,
          to: selection.to,
        };

        menu.addItem((item) => {
          item
            .setTitle("Search in selection")
            .setIcon("search")
            .onClick(() => openWithSelectionOnly(view, false, scope));
        });

        menu.addItem((item) => {
          item
            .setTitle("Replace in selection")
            .setIcon("replace")
            .onClick(() => openWithSelectionOnly(view, true, scope));
        });
      },
    ),
  );
}

function openWithSelectionOnly(
  view: EditorView,
  replaceMode: boolean,
  scope: SearchScope,
) {
  const options = getSearchOptions(view.state);
  view.dispatch({
    effects: [
      toggleSearchPanel.of(true),
      toggleReplaceMode.of(replaceMode),
      setSearchOptions.of({ ...options, selectionOnly: true }),
      setSearchScope.of(scope),
      focusSearchInput.of(),
    ],
  });
}
