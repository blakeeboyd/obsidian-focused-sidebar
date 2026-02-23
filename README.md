# Focused Sidebar

An Obsidian plugin that toggles any sidebar section to fill the full sidebar height.

Obsidian splits each sidebar into three fixed sections. When you want one section to have room to breathe, this plugin collapses the others and gives it the full height. Toggle again to restore the original layout.

## Usage

Three ways to toggle:

- **Command palette:** "Toggle focused sidebar"
- **Ribbon icon:** Click the maximize icon in the left ribbon
- **Right-click:** Right-click any sidebar tab header and choose "Focus this section" (works on both active and inactive tabs)

The plugin auto-detects which sidebar (left or right) based on where you're working. Defaults to the right sidebar if focus is in the main editor.

## How it works

The plugin saves the current section proportions, sets the target section to 100% and the others to 0%, and applies a CSS class to cleanly hide the collapsed sections. Toggling again restores the original proportions exactly.

- Disabling the plugin restores normal layout automatically
- Manually resizing while focused doesn't affect the saved proportions
- Focused state is not persisted across restarts (starts in normal mode)

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder called `focused-sidebar` in your vault's `.obsidian/plugins/` directory
3. Copy the three files into that folder
4. Enable the plugin in Settings > Community Plugins

### Development

```bash
git clone https://github.com/blakeeboyd/obsidian-focused-sidebar.git
cd obsidian-focused-sidebar
npm install
npm run dev    # watch mode
npm run build  # production build
```

Symlink into your vault for development:

```bash
ln -s /path/to/obsidian-focused-sidebar /path/to/vault/.obsidian/plugins/focused-sidebar
```

## Roadmap

**Phase 2: Dedicated full-height row.** A new icon row above the existing sidebar sections for panes that should always display at full height. The Phase 1 toggle would remain as a separate quick-focus command.

## Technical notes

- Uses unofficial but stable internal API properties (`WorkspaceSidedock.children`, `dimension`) that are used by other production plugins (Vertical Tabs, Sidebar Expand on Hover)
- Context menu injection via `monkey-around` patch on `Menu.prototype.showAtMouseEvent`
- Desktop only (mobile uses `WorkspaceMobileDrawer`, a different layout class)

## License

MIT
