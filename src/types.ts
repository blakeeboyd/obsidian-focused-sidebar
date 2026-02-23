import { WorkspaceLeaf, WorkspaceSidedock } from "obsidian";

/**
 * Extended types for internal Obsidian API properties.
 * These are not in the official .d.ts but are stable and used by
 * production plugins (Vertical Tabs, Sidebar Expand on Hover, etc.).
 */

export interface InternalWorkspaceTabs {
	dimension: number;
	children: WorkspaceLeaf[];
	containerEl: HTMLElement;
}

export interface InternalSidedock extends WorkspaceSidedock {
	children: InternalWorkspaceTabs[];
	recomputeChildrenDimensions?: () => void;
}
