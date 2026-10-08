# Extended Find and Replace Regex

A powerful search and replace plugin for Obsidian with full regular expression support, plus selection-scoped search and replace.

> **Acknowledgements** — This plugin is an extended fork of [Search and Replace Regex](https://github.com/TheJusticeMan/obsidian-find-replace-regex) by **Justice Vellacott**. Many thanks to the original author for the excellent foundation this project builds upon. Thanks also to [No3371's Regex Pipeline](https://github.com/No3371/obsidian-regex-pipeline/) for the idea that inspired this plugin's preset-pipeline feature; this project does not use its code.

## Features

- **Search**: Search your notes with regular expressions, plain text, or whole word matching
- **Replace**: Replace single or all occurrences with support for regex capture groups
- **Selection-scoped search**: Restrict search and replace to only the text you have selected
- **Context menu actions**: Right-click a selection and jump straight into **Search in selection** or **Replace in selection**
- **Search Options**:
  - Case sensitive matching
  - Whole word matching
  - Regular expression mode (or plain text mode)
  - Selection only mode
- **Navigation**: Jump between matches with keyboard shortcuts or buttons
- **Search History**: Access your recent searches and replacements
- **Regex presets**: Save named, ordered search-and-replace rules and run each preset from the command palette
- **Preset pipelines**: Combine presets into a named ordered pipeline and run the full sequence from one command
- **Preset transfer**: Export presets and pipelines to JSON and import them into another vault
- **Preset management**: Fold preset and pipeline cards, rename items in a popup, and reorder rules or pipeline steps
- **Match Counter**: See which match you're on (e.g., "3 / 12")
- **Match highlighting**: All matches are highlighted and the current match has a visible outline, including zero-width line-break matches
- **Live Preview highlighting**: Search highlights can also appear in rendered Markdown widgets where supported by Obsidian's browser engine
- **ECMAScript regex**: Uses JavaScript regular expressions, including lookahead, lookbehind, and multiline `^` / `$` anchors
- **Persistent Settings**: Search preferences, history, presets, and pipelines are saved in the vault

## Installation

1. Download the plugin files (`main.js`, `manifest.json`, `styles.css`) from the latest [release](https://github.com/jasonshelter0/extended-find-replace-regex/releases)
2. Place them in your vault: `.obsidian/plugins/extended-find-replace-regex/`
3. Reload Obsidian
4. Enable the plugin in **Settings → Community plugins**

### Install with BRAT

Use BRAT to install and track this GitHub release before the plugin is available in Obsidian's Community Plugins directory:

1. In **Settings → Community plugins → Browse**, install and enable **BRAT** (Obsidian42 - BRAT).
2. Open the command palette and run **BRAT: Add a beta plugin for testing**.
3. Enter `https://github.com/jasonshelter0/extended-find-replace-regex` and add the plugin.
4. Enable **Extended Find and Replace Regex** in **Settings → Community plugins**.

BRAT tracks GitHub releases for the repository. You can also use **BRAT: Add a beta plugin with frozen version based on a release tag** to pin a particular release.

## Usage

### Quick Start

Press <kbd>Ctrl/Cmd</kbd> + <kbd>F</kbd> (or use the command palette) to open the Search panel:

- Type your search query (regex or plain text)
- Use the toggle buttons to customize your search:
  - **Case sensitive**: Match letter casing
  - **Whole word**: Match only complete words
  - **Use regex**: Enable regular expression mode
  - **Selection only**: Search only within the currently selected text
- Navigate matches with **↑** and **↓** buttons or press <kbd>F3</kbd> for next

### Replace

Press <kbd>Ctrl/Cmd</kbd> + <kbd>H</kbd> to open Search & Replace:

- Enter your search query and replacement text
- Click **Replace & Search** to replace one occurrence and move to the next
- Click **Replace All** to replace all matches at once
- Regex capture groups (like `$1`, `$2`) work in replacements
- Enter `\n` in the replacement field to insert a line break; enter `\\n` for a literal `\n`
- Search for line breaks with regex patterns such as `\n`; zero-width matches (for example, lookarounds) can be navigated, too

Search and replace uses JavaScript ECMAScript regular expressions with global and multiline matching. Lookahead and lookbehind are supported by the Obsidian runtime. With multiline matching, `^` and `$` match the start and end of each line. Case sensitivity, whole-word matching, and regex mode are configurable in the search panel.

### Selection-scoped search and replace

1. Select the text you want to search within
2. Either:
   - Open the panel and toggle **Selection only**, **or**
   - Right-click the selection and choose **Search in selection** / **Replace in selection**
3. Search and replace now only affect the selected range
4. The selected range stays highlighted while you work, and you can re-select a different range to move the scope

### Keyboard Shortcuts

| Action         | Shortcut                                              |
| -------------- | ----------------------------------------------------- |
| Search         | <kbd>Ctrl/Cmd</kbd> + <kbd>F</kbd>                    |
| Replace        | <kbd>Ctrl/Cmd</kbd> + <kbd>H</kbd>                    |
| Next match     | <kbd>F3</kbd> or <kbd>Enter</kbd>                     |
| Previous match | <kbd>Shift</kbd> + <kbd>F3</kbd>                      |
| Replace single | <kbd>Ctrl/Cmd</kbd> + <kbd>Enter</kbd>                |
| Replace all    | <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd> |
| History        | <kbd>Ctrl/Cmd</kbd> + <kbd>↓</kbd>                    |
| Exit search    | <kbd>Esc</kbd>                                        |

### Search History

Access previous searches with:

- **Arrow keys** in the search field to cycle through history
- **History button** or <kbd>Ctrl/Cmd</kbd> + <kbd>↓</kbd> to browse all past searches
- Click the trash icon to delete individual history entries

### Regex presets

In **Settings → Extended Find and Replace Regex → Regex presets**, add a preset and one or more rules. Each rule has a name, search pattern, replacement, and case-sensitive/whole-word options. Click an item's displayed name to rename it in a popup. Use the arrow buttons to reorder rules or pipeline steps. Fold cards with the chevron to keep the settings compact. An empty replacement removes matches. If a rule has an invalid regex, the preset or pipeline stops before changing the note.

- Select the bookmark button in the search panel, or run **Search with regex preset**, to load the first rule of a preset into the search box.
- Run **Apply regex preset** to choose a preset and execute all its rules in order. Each saved preset also has its own **Apply preset: …** command, which can be assigned a hotkey.
- Create a **Preset pipeline** to run several presets in order. Use **Apply regex preset pipeline** to choose one, or run its individual **Apply preset pipeline: …** command.
- If text is selected, applying a preset or pipeline changes only that selection. Otherwise, it changes the current note. Each preset or pipeline is applied as one editor change.
- Use **Export** and **Import** in the preset settings to transfer presets and pipelines between vaults. Import merges the file with existing items and resolves ID collisions automatically.

The plugin stores its settings at `.obsidian/plugins/extended-find-replace-regex/data.json` in the vault. Use JSON export/import to move only presets and pipelines to another vault.

### Settings

Configure default search options in **Settings → Extended Find and Replace Regex**:

- Set default case sensitivity
- Enable whole word matching by default
- Enable regex mode by default
- Adjust maximum history items (5-50)
- Manage, import, and export regex presets and pipelines

## Examples

### Search email addresses

```
\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b
```

### Search and replace dates

Search: `(\d{4})-(\d{2})-(\d{2})`  
Replace: `$3/$2/$1`

### Remove duplicate words

Search: `\b(\w+)\s+\1\b`  
Replace: `$1`

## Development

### Setup

```bash
npm i
```

### Build

```bash
npm run build
```

### Watch mode

```bash
npm run dev
```

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format
```

## License

[MIT License](LICENSE)
