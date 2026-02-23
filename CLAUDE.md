# Focused Sidebar — CLAUDE.md

## What this is

An Obsidian plugin that toggles sidebar sections to full height. Phase 1 is a simple toggle; Phase 2 (planned) adds a dedicated full-height icon row.

## Architecture

Single entry point: `src/main.ts`. One plugin class, no settings tab, no custom views.

### Key internals

- **Sidebar structure:** `workspace.rightSplit` / `leftSplit` is a `WorkspaceSidedock` whose `children` array contains `WorkspaceTabs` items. Each has a `dimension` property controlling flex-grow percentage. These are unofficial API properties — see `src/types.ts` for type extensions.
- **Toggle mechanism:** Save current dimensions, set target to 100 / others to 0, apply CSS class `focused-sidebar-collapsed` to hide collapsed sections. Restore on toggle-back.
- **Context menu:** Patches `Menu.prototype.showAtMouseEvent` via `monkey-around` to inject "Focus this section" into sidebar tab header right-click menus. This catches both active and inactive tabs (unlike `View.prototype.onPaneMenu` which only fires for the active view).
- **Leaf activation:** When focusing via right-click on an inactive tab, the clicked leaf is activated via `workspace.setActiveLeaf()` so the tab becomes visible.

### State

- `savedDimensions: Map<string, number[]>` — original section proportions, keyed by `"left"` / `"right"`. In-memory only, not persisted.
- `focusedSide: string | null` — which sidebar is currently focused. `null` means normal mode.
- `onunload()` restores normal layout and removes the menu patch.

## Build

```bash
npm run dev    # esbuild watch mode
npm run build  # typecheck + production build
```

Output: `main.js` (committed, loaded by Obsidian).

The plugin is symlinked into the vault at `.obsidian/plugins/focused-sidebar`. Reload Obsidian with Cmd+R after rebuilding.

## Phase 2 plan

Add a dedicated `WorkspaceTabs` group at index 0 of the sidedock for panes that always display at full height. Involves DOM injection for a custom icon row and managing a persistent tab group across restarts. Phase 1 toggle remains as a separate command.

## Dependencies

- `obsidian` — plugin API (external, provided by Obsidian at runtime)
- `monkey-around` — safe method patching with automatic cleanup
