# Changelog

## 0.1.1

- Fix focused section overlapping macOS traffic light buttons in the left sidebar
- Known issue: first section tab icon shifts slightly when focused (cosmetic only)

## 0.1.0

Initial release.

- Toggle any sidebar section to full height
- Four entry points: command palette, ribbon icon, right-click menu, double-click
- Targeted commands for left sidebar, right sidebar, and cycling sections
- Five indicator styles: highlight, underline, glow, icon-only, button
- Custom color picker (or uses theme accent color)
- Smooth CSS transitions
- ARIA attributes on collapsed sections
- Crash-safe: collapsed dimensions are never persisted to the workspace file
- Graceful exit when section count changes mid-focus
