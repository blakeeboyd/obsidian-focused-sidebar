import { Menu, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { around } from "monkey-around";
import { InternalSidedock, InternalWorkspaceTabs } from "./types";

const COLLAPSED_CLASS = "focused-sidebar-collapsed";
const ACTIVE_CLASS = "focused-sidebar-active";

export default class FocusedSidebarPlugin extends Plugin {
	private savedDimensions: Map<string, number[]> = new Map();
	private focusedSide: string | null = null;
	private unpatchMenu: (() => void) | null = null;

	async onload(): Promise<void> {
		this.addCommand({
			id: "toggle-focused-sidebar",
			name: "Toggle focused sidebar",
			callback: () => this.toggleFocus(),
		});

		this.addRibbonIcon("maximize", "Toggle focused sidebar", () => {
			this.toggleFocus();
		});

		this.patchMenu();
	}

	onunload(): void {
		if (this.focusedSide) {
			this.restoreDimensions(this.focusedSide);
			document.body.removeClass(ACTIVE_CLASS);
		}
		if (this.unpatchMenu) {
			this.unpatchMenu();
			this.unpatchMenu = null;
		}
	}

	private patchMenu(): void {
		const plugin = this;

		this.unpatchMenu = around(Menu.prototype, {
			showAtMouseEvent(old) {
				return function (this: Menu, evt: MouseEvent) {
					plugin.maybeAddFocusItem(this, evt);
					return old.call(this, evt);
				};
			},
		});
	}

	private maybeAddFocusItem(menu: Menu, evt: MouseEvent): void {
		const target = evt.target as HTMLElement;
		if (!target) return;

		// Check if the click was on a sidebar tab header
		const tabHeader = target.closest(".workspace-tab-header");
		if (!tabHeader) return;

		const tabsEl = tabHeader.closest(".workspace-tabs");
		if (!tabsEl) return;

		const sidebarEl = tabsEl.closest(
			".mod-left-split, .mod-right-split"
		);
		if (!sidebarEl) return;

		const side = sidebarEl.classList.contains("mod-left-split")
			? "left"
			: "right";
		const split = this.getSplit(side);
		if (!split || split.children.length <= 1) return;

		// Find which section this tab header belongs to
		const sectionIndex = split.children.findIndex(
			(s) => s.containerEl === tabsEl
		);
		if (sectionIndex === -1) return;

		const isFocused = this.focusedSide === side;

		// Find which leaf was clicked by matching tab header index
		const section = split.children[sectionIndex];
		const tabHeaderContainer = tabsEl.querySelector(
			".workspace-tab-header-container"
		);
		const allHeaders = tabHeaderContainer
			? Array.from(
					tabHeaderContainer.querySelectorAll(
						".workspace-tab-header"
					)
				)
			: [];
		const tabIndex = allHeaders.indexOf(tabHeader as Element);
		const clickedLeaf =
			tabIndex >= 0 && tabIndex < section.children.length
				? section.children[tabIndex]
				: null;

		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle(isFocused ? "Unfocus sidebar" : "Focus this section")
				.setIcon(isFocused ? "minimize" : "maximize")
				.onClick(() => {
					if (isFocused) {
						this.unfocus();
					} else {
						this.focusSection(side, split, sectionIndex);
					}
					// Activate the clicked leaf so the tab becomes visible
					if (clickedLeaf) {
						this.app.workspace.setActiveLeaf(clickedLeaf, {
							focus: true,
						});
					}
				});
		});
	}

	private toggleFocus(): void {
		const side = this.resolveSide();
		const split = this.getSplit(side);
		if (!split) {
			new Notice("No sidebar found.");
			return;
		}

		const sections = split.children;
		if (sections.length <= 1) {
			new Notice("Sidebar has only one section.");
			return;
		}

		// Already focused on this side — restore
		if (this.focusedSide === side) {
			this.unfocus();
			return;
		}

		const activeIndex = this.findActiveSectionIndex(split);
		this.focusSection(side, split, activeIndex);
	}

	private focusSection(
		side: string,
		split: InternalSidedock,
		sectionIndex: number
	): void {
		const sections = split.children;

		// Restore other side if focused
		if (this.focusedSide && this.focusedSide !== side) {
			this.restoreDimensions(this.focusedSide);
		}

		// Save current dimensions (only if not already saved for this side)
		if (!this.savedDimensions.has(side)) {
			this.savedDimensions.set(
				side,
				sections.map((s) => s.dimension)
			);
		}

		// Focus: target section gets everything, others collapse
		sections.forEach((section, i) => {
			if (i === sectionIndex) {
				section.dimension = 100;
				section.containerEl.removeClass(COLLAPSED_CLASS);
			} else {
				section.dimension = 0;
				section.containerEl.addClass(COLLAPSED_CLASS);
			}
		});

		this.applyLayout(split);
		this.focusedSide = side;
		document.body.addClass(ACTIVE_CLASS);
	}

	private unfocus(): void {
		if (!this.focusedSide) return;
		this.restoreDimensions(this.focusedSide);
		this.focusedSide = null;
		document.body.removeClass(ACTIVE_CLASS);
	}

	private restoreDimensions(side: string): void {
		const saved = this.savedDimensions.get(side);
		const split = this.getSplit(side);
		if (!saved || !split) return;

		const sections = split.children;
		const fallback = 100 / sections.length;

		sections.forEach((section, i) => {
			section.dimension = saved[i] ?? fallback;
			section.containerEl.removeClass(COLLAPSED_CLASS);
		});

		this.applyLayout(split);
		this.savedDimensions.delete(side);
	}

	private applyLayout(split: InternalSidedock): void {
		if (typeof split.recomputeChildrenDimensions === "function") {
			split.recomputeChildrenDimensions();
		}
		this.app.workspace.requestSaveLayout();
	}

	private resolveSide(): string {
		const activeLeaf = this.app.workspace.activeLeaf;
		if (activeLeaf) {
			const root = activeLeaf.getRoot();
			if (root === this.app.workspace.leftSplit) return "left";
			if (root === this.app.workspace.rightSplit) return "right";
		}
		return "right";
	}

	private getSplit(side: string): InternalSidedock | null {
		const split =
			side === "left"
				? this.app.workspace.leftSplit
				: this.app.workspace.rightSplit;
		return split as unknown as InternalSidedock;
	}

	private findActiveSectionIndex(split: InternalSidedock): number {
		const activeLeaf = this.app.workspace.activeLeaf;

		if (activeLeaf) {
			const idx = this.findSectionIndexForLeaf(split, activeLeaf);
			if (idx !== -1) return idx;
		}

		// Fallback: most recent leaf in this split
		const recent = this.app.workspace.getMostRecentLeaf(split as any);
		if (recent) {
			const idx = this.findSectionIndexForLeaf(split, recent);
			if (idx !== -1) return idx;
		}

		return 0;
	}

	private findSectionIndexForLeaf(
		split: InternalSidedock,
		leaf: WorkspaceLeaf
	): number {
		for (let i = 0; i < split.children.length; i++) {
			if (split.children[i].children.some((child) => child === leaf)) {
				return i;
			}
		}
		return -1;
	}
}
