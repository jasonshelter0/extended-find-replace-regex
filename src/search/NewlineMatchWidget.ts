import { EditorView, WidgetType } from "@codemirror/view";

/** A line break has no glyph for a mark decoration to color. */
export class NewlineMatchWidget extends WidgetType {
  constructor(private current: boolean) {
    super();
  }

  eq(other: NewlineMatchWidget): boolean {
    return this.current === other.current;
  }

  toDOM(view: EditorView): HTMLElement {
    const marker = view.dom.ownerDocument.createElement("span");
    marker.className = this.current
      ? "document-search-newline-match document-search-newline-match-current"
      : "document-search-newline-match";
    marker.textContent = "↵";
    marker.title = "Matched line break";
    return marker;
  }
}
