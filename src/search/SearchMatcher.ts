import { SearchOptions } from "../state";

export interface MatchResult {
  start: number;
  end: number;
  text: string;
  groups?: string[];
}

export class SearchMatcher {
  private regex: RegExp | null = null;
  private lastQuery: string = "";
  private lastOptions: SearchOptions = {
    caseSensitive: false,
    wholeWord: false,
    useRegex: true,
    selectionOnly: false,
  };

  constructor(private query: string = "") {
    this.updateRegex(query);
  }

  private sameRegexConfig(query: string, options: SearchOptions): boolean {
    return (
      query === this.lastQuery &&
      options.caseSensitive === this.lastOptions.caseSensitive &&
      options.wholeWord === this.lastOptions.wholeWord &&
      options.useRegex === this.lastOptions.useRegex
    );
  }

  updateRegex(
    query: string,
    options: SearchOptions = {
      caseSensitive: false,
      wholeWord: false,
      useRegex: true,
      selectionOnly: false,
    },
  ): void {
    // Keep the compiled regex when the regex-relevant config is unchanged
    // (checked against the previous values). Non-regex fields such as
    // selectionOnly are refreshed below without rebuilding.
    if (this.regex !== null && this.sameRegexConfig(query, options)) {
      this.lastQuery = query;
      this.lastOptions = options;
      return;
    }

    this.lastQuery = query;
    this.lastOptions = options;

    if (!query) {
      this.regex = null;
      return;
    }

    try {
      let pattern = query;
      // Search line anchors the same way an editor find box does.
      let flags = "gm";

      if (!options.caseSensitive) {
        flags += "i";
      }

      if (!options.useRegex) {
        // Escape special regex characters for literal search
        pattern = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }

      if (options.wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }

      this.regex = new RegExp(pattern, flags);
    } catch {
      this.regex = null;
    }
  }

  isValid(): boolean {
    return this.regex !== null;
  }

  findMatches(text: string): MatchResult[] {
    if (!this.regex || !this.lastQuery) return [];

    const matches: MatchResult[] = [];
    let match;

    this.regex.lastIndex = 0;
    while ((match = this.regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        groups: match.slice(1), // Capture groups for replacement
      });
      if (match[0].length === 0) this.regex.lastIndex = match.index + 1;
    }

    return matches;
  }

  getMatchCount(text: string): number {
    return this.findMatches(text).length;
  }

  private expandReplacementEscapes(replacement: string): string {
    let result = "";
    for (let i = 0; i < replacement.length; i++) {
      const char = replacement[i];
      if (char === "\\" && i + 1 < replacement.length) {
        const next = replacement[i + 1];
        if (next === "n") {
          result += "\n";
          i++;
          continue;
        }
        if (next === "\\") {
          result += "\\";
          i++;
          continue;
        }
      }
      result += char;
    }
    return result;
  }

  replaceMatches(text: string, replacement: string): string {
    if (!this.regex || !this.lastQuery) return text;
    const expandedReplacement = this.expandReplacementEscapes(replacement);

    try {
      return text.replace(this.regex, expandedReplacement);
    } catch {
      // Fallback to simple string replacement if regex replacement fails
      if (this.lastOptions.useRegex) {
        return text.split(this.lastQuery).join(expandedReplacement);
      } else {
        return text.replace(
          new RegExp(
            this.lastQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "g",
          ),
          expandedReplacement,
        );
      }
    }
  }

  replaceSingleMatch(
    text: string,
    replacement: string,
    matchIndex: number,
  ): { result: string; replaced: boolean } {
    const matches = this.findMatches(text);
    const match = matches[matchIndex];
    if (!match) return { result: text, replaced: false };

    // A sticky regex runs against the complete document at the chosen match.
    // This preserves lookbehind, lookahead, ^/$ and replacement context.
    const singleRegex = new RegExp(
      this.regex!.source,
      this.regex!.flags.replace("g", "") + "y",
    );
    singleRegex.lastIndex = match.start;
    return {
      result: text.replace(
        singleRegex,
        this.expandReplacementEscapes(replacement),
      ),
      replaced: true,
    };
  }

  getLastOptions(): SearchOptions {
    return { ...this.lastOptions };
  }
}
