import { EditorView } from "@codemirror/view";
import { SearchMatcher } from "./SearchMatcher";
import { SearchOptions, SearchScope } from "../state";

// Live Preview replaces some Markdown ranges with rendered DOM. CodeMirror
// decorations on the hidden source cannot paint the replacement widget.
const highlightName = "document-search-rendered";
const rangesByView = new Map<EditorView, Range[]>();
const publishedDocuments = new Set<Document>();
const widgetSelector =
  ".cm-embed-block, .cm-callout, .cm-table-widget, .cm-preview-code-block";

function publish(): void {
  const byDocument = new Map<Document, Range[]>();
  for (const [view, ranges] of rangesByView) {
    const doc = view.dom.ownerDocument;
    byDocument.set(doc, [...(byDocument.get(doc) ?? []), ...ranges]);
  }
  for (const doc of new Set([...publishedDocuments, ...byDocument.keys()])) {
    const win = doc.defaultView;
    const registry = win?.CSS?.highlights;
    if (!registry) continue;
    const ranges = byDocument.get(doc) ?? [];
    if (ranges.length)
      registry.set(highlightName, new win.Highlight(...ranges));
    else registry.delete(highlightName);
    if (ranges.length) publishedDocuments.add(doc);
    else publishedDocuments.delete(doc);
  }
}

function visibleTextNodes(root: Element, activeDocument: Document): Text[] {
  const nodes: Text[] = [];
  const walker = activeDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (
      node.data &&
      !node.parentElement?.closest(".document-search-container, script, style")
    )
      nodes.push(node);
  }
  return nodes;
}

function touchesWidget(view: EditorView, root: Element, pos: number): boolean {
  const { node, offset } = view.domAtPos(pos);
  if (root === node || root.contains(node)) return true;
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const before = node.childNodes[offset - 1];
  const after = node.childNodes[offset];
  return [before, after].some(
    (child) =>
      child === root ||
      (child?.nodeType === Node.ELEMENT_NODE &&
        (child as Element).contains(root)),
  );
}

export class RenderedHighlights {
  private matcher = new SearchMatcher();
  private observer: MutationObserver;
  private frame = 0;
  private layoutFrame = 0;
  private observing = false;
  private query = "";
  private options: SearchOptions | null = null;
  private currentIndex = 0;
  private scope: SearchScope | null = null;
  private currentRange: Range | null = null;
  private outlines: HTMLDivElement;
  private activeWindow: Window;
  private onScroll = () => this.scheduleOutlines();

  constructor(private view: EditorView) {
    this.activeWindow = view.dom.ownerDocument.defaultView ?? window;
    this.outlines = view.dom.ownerDocument.createElement("div");
    this.outlines.className = "document-search-rendered-outlines";
    view.dom.ownerDocument.body.appendChild(this.outlines);
    view.scrollDOM.addEventListener("scroll", this.onScroll, { passive: true });
    view.contentDOM.addEventListener("scroll", this.onScroll, {
      capture: true,
      passive: true,
    });
    this.activeWindow.addEventListener("resize", this.onScroll);
    this.observer = new MutationObserver(() => this.schedule());
  }

  update(
    query: string,
    options: SearchOptions,
    currentIndex: number,
    scope: SearchScope | null,
  ): void {
    this.query = query;
    this.options = options;
    this.currentIndex = currentIndex;
    this.scope = scope;
    if (query && !this.observing) {
      this.observer.observe(this.view.contentDOM, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      this.observing = true;
    } else if (!query && this.observing) {
      this.observer.disconnect();
      this.observing = false;
    }
    this.schedule();
  }

  private schedule(): void {
    if (!this.frame)
      this.frame = this.activeWindow.requestAnimationFrame(() => {
        this.frame = 0;
        this.paint();
      });
  }

  private scheduleOutlines(): void {
    if (!this.layoutFrame)
      this.layoutFrame = this.activeWindow.requestAnimationFrame(() => {
        this.layoutFrame = 0;
        this.drawOutlines();
      });
  }

  private drawOutlines(): void {
    const scrollRect = this.view.scrollDOM.getBoundingClientRect();
    this.outlines.style.left = `${scrollRect.left}px`;
    this.outlines.style.top = `${scrollRect.top}px`;
    this.outlines.style.width = `${scrollRect.width}px`;
    this.outlines.style.height = `${scrollRect.height}px`;
    const fragment = this.view.dom.ownerDocument.createDocumentFragment();
    if (this.currentRange) {
      const range = this.currentRange;
      for (const rect of range.getClientRects()) {
        if (
          !rect.width ||
          !rect.height ||
          rect.right <= scrollRect.left ||
          rect.left >= scrollRect.right ||
          rect.bottom <= scrollRect.top ||
          rect.top >= scrollRect.bottom
        )
          continue;
        const box = this.view.dom.ownerDocument.createElement("div");
        box.className = "document-search-rendered-outline";
        box.style.left = `${rect.left - scrollRect.left}px`;
        box.style.top = `${rect.top - scrollRect.top}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        fragment.appendChild(box);
      }
    }
    this.outlines.replaceChildren(fragment);
  }

  private paint(): void {
    const win = this.view.dom.ownerDocument.defaultView;
    if (!win?.CSS?.highlights || !this.options || !this.query) {
      rangesByView.delete(this.view);
      this.currentRange = null;
      this.outlines.replaceChildren();
      publish();
      return;
    }
    this.matcher.updateRegex(this.query, this.options);
    if (!this.matcher.isValid()) {
      rangesByView.delete(this.view);
      this.currentRange = null;
      this.outlines.replaceChildren();
      publish();
      return;
    }
    const ranges: Range[] = [];
    const sourceOffset = this.options.selectionOnly ? this.scope?.from : 0;
    const sourceText = this.options.selectionOnly
      ? this.scope &&
        this.view.state.doc.sliceString(this.scope.from, this.scope.to)
      : this.view.state.doc.toString();
    const sourceMatches =
      sourceText === null || sourceText === undefined
        ? []
        : this.matcher.findMatches(sourceText).map((match) => ({
            ...match,
            start: match.start + (sourceOffset ?? 0),
            end: match.end + (sourceOffset ?? 0),
          }));
    const current = sourceMatches[this.currentIndex];
    let currentRange: Range | null = null;
    for (const root of this.view.dom.querySelectorAll(widgetSelector)) {
      if (root.parentElement?.closest(widgetSelector)) continue;
      const activeDocument = this.view.dom.ownerDocument;
      const nodes = visibleTextNodes(root, activeDocument);
      const text = nodes.map((node) => node.data).join("");
      if (!text) continue;
      const offsets: number[] = [];
      let total = 0;
      for (const node of nodes) {
        offsets.push(total);
        total += node.length;
      }
      const visibleMatches: { text: string; range: Range }[] = [];
      for (const match of this.matcher.findMatches(text)) {
        if (match.start === match.end) continue;
        const first = offsets.findLastIndex((offset) => offset <= match.start);
        const last = offsets.findLastIndex((offset) => offset < match.end);
        if (first < 0 || last < 0) continue;
        const range = activeDocument.createRange();
        range.setStart(nodes[first], match.start - offsets[first]);
        range.setEnd(nodes[last], match.end - offsets[last]);
        ranges.push(range);
        visibleMatches.push({ text: match.text, range });
      }
      if (current && !currentRange) {
        const equal = (text: string) =>
          this.options?.caseSensitive
            ? text === current.text
            : text.toLowerCase() === current.text.toLowerCase();
        const candidates = visibleMatches.filter((match) => equal(match.text));
        let from = -1;
        let to = -1;
        try {
          from = this.view.posAtDOM(root, 0);
          to = this.view.posAtDOM(root, root.childNodes.length);
        } catch {
          // Widgets supplied by other plugins may sit outside CodeMirror's DOM.
        }
        try {
          const contains = (match: { start: number; end: number }) =>
            (from < to && from <= match.start && match.end <= to) ||
            (touchesWidget(this.view, root, match.start) &&
              touchesWidget(this.view, root, match.end));
          if (contains(current)) {
            const ordinal = sourceMatches.filter(
              (match) =>
                match.start < current.start &&
                contains(match) &&
                equal(match.text),
            ).length;
            currentRange = candidates[ordinal]?.range ?? null;
          }
        } catch {
          // A document update may replace a widget during this frame.
        }
        if (!currentRange && candidates.length === 1) {
          const position = this.view.coordsAtPos(current.start);
          const bounds = root.getBoundingClientRect();
          if (
            position &&
            position.top <= bounds.bottom &&
            position.bottom >= bounds.top
          )
            currentRange = candidates[0].range;
        }
      }
    }
    rangesByView.set(this.view, ranges);
    this.currentRange = currentRange;
    publish();
    this.drawOutlines();
  }

  destroy(): void {
    this.observer.disconnect();
    this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
    this.view.contentDOM.removeEventListener("scroll", this.onScroll, true);
    this.activeWindow.removeEventListener("resize", this.onScroll);
    if (this.frame) this.activeWindow.cancelAnimationFrame(this.frame);
    if (this.layoutFrame)
      this.activeWindow.cancelAnimationFrame(this.layoutFrame);
    this.outlines.remove();
    rangesByView.delete(this.view);
    publish();
  }
}
