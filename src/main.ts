import { Menu, Notice, Plugin, WorkspaceLeaf, WorkspaceSidedock } from "obsidian";
import { around } from "monkey-around";
import { InternalSidedock } from "./types";
import {
	DEFAULT_SETTINGS,
	FocusedSidebarSettings,
	FocusedSidebarSettingTab,
} from "./settings";

type Side = "left" | "right";

const COLLAPSED_CLASS = "focused-sidebar-collapsed";
const ACTIVE_CLASS = "focused-sidebar-active";
const TARGET_CLASS = "focused-sidebar-target";

/** Convert hex "#rrggbb" to "r, g, b" for use in rgba(). */
function hexToRgb(hex: string): string {
	const h = hex.replace("#", "");
	const n = parseInt(h, 16);
	return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Read the resolved accent color from the theme as a hex string. */
function getAccentColor(): string {
	const raw = getComputedStyle(document.body)
		.getPropertyValue("--interactive-accent")
		.trim();
	// Could be hex, rgb(), or hsl() — normalise to hex via a throwaway element
	if (raw.startsWith("#")) return raw;
	const tmp = document.createElement("div");
	tmp.style.color = raw;
	document.body.appendChild(tmp);
	const computed = getComputedStyle(tmp).color; // always "rgb(r, g, b)"
	tmp.remove();
	const m = computed.match(/(\d+)/g);
	if (!m) return "#7f6df2"; // safe fallback
	return (
		"#" +
		m
			.slice(0, 3)
			.map((n) => parseInt(n).toString(16).padStart(2, "0"))
			.join("")
	);
}

export default class FocusedSidebarPlugin extends Plugin {
	settings: FocusedSidebarSettings = DEFAULT_SETTINGS;
	private savedDimensions: Map<string, number[]> = new Map();
	private focusedSide: Side | null = null;
	private unpatchMenu: (() => void) | null = null;
	private dblClickHandler: ((evt: MouseEvent) => void) | null = null;
	private statusBarEl: HTMLElement | null = null;
	private ribbonIconEl: HTMLElement | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new FocusedSidebarSettingTab(this.app, this));

		this.addCommand({
			id: "toggle-focused-sidebar",
			name: "Toggle focused sidebar",
			callback: () => this.toggleFocus(),
		});

		this.addCommand({
			id: "focus-left-sidebar",
			name: "Focus left sidebar",
			callback: () => this.toggleFocusSide("left"),
		});

		this.addCommand({
			id: "focus-right-sidebar",
			name: "Focus right sidebar",
			callback: () => this.toggleFocusSide("right"),
		});

		this.addCommand({
			id: "cycle-focused-section",
			name: "Cycle to next section",
			callback: () => this.cycleFocus(),
		});

		if (this.settings.showRibbonIcon) {
			this.ribbonIconEl = this.addRibbonIcon(
				"panel-left",
				"Toggle focused sidebar",
				() => this.toggleFocus()
			);
		}

		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.style.display = "none";

		this.patchMenu();
		this.registerDblClick();
		this.registerLayoutChange();
	}

	onunload(): void {
		if (this.focusedSide) {
			this.restoreDimensions(this.focusedSide);
			document.body.removeClass(ACTIVE_CLASS);
			this.removeStyleAttrs();
		}
		if (this.unpatchMenu) {
			this.unpatchMenu();
			this.unpatchMenu = null;
		}
		if (this.dblClickHandler) {
			document.removeEventListener("dblclick", this.dblClickHandler, true);
			this.dblClickHandler = null;
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		this.applyStyleAttrs();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.applyStyleAttrs();
	}

	/** Push settings into CSS custom properties and a data attribute on body. */
	private applyStyleAttrs(): void {
		const el = document.body;
		el.dataset.focusedSidebarStyle = this.settings.indicatorStyle;

		const color = this.settings.useCustomColor
			? this.settings.customColor
			: getAccentColor();
		el.style.setProperty("--focused-sidebar-color", color);
		el.style.setProperty("--focused-sidebar-color-rgb", hexToRgb(color));
	}

	private removeStyleAttrs(): void {
		delete document.body.dataset.focusedSidebarStyle;
		document.body.style.removeProperty("--focused-sidebar-color");
		document.body.style.removeProperty("--focused-sidebar-color-rgb");
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

	private registerDblClick(): void {
		this.dblClickHandler = (evt: MouseEvent) => {
			const hit = this.resolveTabHit(evt);
			if (!hit) return;

			// Prevent Obsidian's default double-click behavior (e.g. rename)
			evt.stopPropagation();

			const { side, split, sectionIndex, clickedLeaf } = hit;
			const isFocused = this.focusedSide === side;

			if (isFocused) {
				this.unfocus();
			} else {
				this.focusSection(side, split, sectionIndex);
			}

			if (clickedLeaf) {
				this.app.workspace.setActiveLeaf(clickedLeaf, { focus: true });
			}
		};

		// Capture phase so we fire before Obsidian's own handlers
		document.addEventListener("dblclick", this.dblClickHandler, true);
	}

	private registerLayoutChange(): void {
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				if (!this.focusedSide) return;
				const split = this.getSplit(this.focusedSide);
				if (!split) return;
				const saved = this.savedDimensions.get(this.focusedSide);
				if (saved && split.children.length !== saved.length) {
					this.unfocus();
				}
			})
		);
	}

	/**
	 * Given a mouse event on a sidebar tab header, resolve which side,
	 * section, and leaf were targeted. Returns null if the click wasn't
	 * on a sidebar tab header or the sidebar has only one section.
	 */
	private resolveTabHit(evt: MouseEvent): {
		side: Side;
		split: InternalSidedock;
		sectionIndex: number;
		clickedLeaf: WorkspaceLeaf | null;
	} | null {
		const target = evt.target as HTMLElement;
		if (!target) return null;

		const tabHeader = target.closest(".workspace-tab-header");
		if (!tabHeader) return null;

		const tabsEl = tabHeader.closest(".workspace-tabs");
		if (!tabsEl) return null;

		const sidebarEl = tabsEl.closest(
			".mod-left-split, .mod-right-split"
		);
		if (!sidebarEl) return null;

		const side = sidebarEl.classList.contains("mod-left-split")
			? "left"
			: "right";
		const split = this.getSplit(side);
		if (!split || split.children.length <= 1) return null;

		const sectionIndex = split.children.findIndex(
			(s) => s.containerEl === tabsEl
		);
		if (sectionIndex === -1) return null;

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

		return { side, split, sectionIndex, clickedLeaf };
	}

	private maybeAddFocusItem(menu: Menu, evt: MouseEvent): void {
		const hit = this.resolveTabHit(evt);
		if (!hit) return;

		const { side, split, sectionIndex, clickedLeaf } = hit;
		const isFocused = this.focusedSide === side;

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

	private toggleFocusSide(side: Side): void {
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

		if (this.focusedSide === side) {
			this.unfocus();
			return;
		}

		const activeIndex = this.findActiveSectionIndex(split);
		this.focusSection(side, split, activeIndex);
	}

	private cycleFocus(): void {
		if (!this.focusedSide) {
			new Notice("No section is focused.");
			return;
		}

		const split = this.getSplit(this.focusedSide);
		if (!split || split.children.length <= 1) return;

		const currentIndex = split.children.findIndex(
			(s) => s.containerEl.hasClass(TARGET_CLASS)
		);
		const nextIndex = (currentIndex + 1) % split.children.length;
		this.focusSection(this.focusedSide, split, nextIndex);
	}

	private focusSection(
		side: Side,
		split: InternalSidedock,
		sectionIndex: number
	): void {
		const sections = split.children;
		if (sectionIndex < 0 || sectionIndex >= sections.length) return;

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

		// Focus: target section gets everything, others collapse.
		// Pass persist=false so collapsed dimensions don't get saved to
		// the workspace file — prevents broken sidebar on crash.
		sections.forEach((section, i) => {
			if (i === sectionIndex) {
				section.dimension = 100;
				section.containerEl.removeClass(COLLAPSED_CLASS);
				section.containerEl.addClass(TARGET_CLASS);
				section.containerEl.removeAttribute("aria-hidden");
			} else {
				section.dimension = 0;
				section.containerEl.addClass(COLLAPSED_CLASS);
				section.containerEl.removeClass(TARGET_CLASS);
				section.containerEl.setAttribute("aria-hidden", "true");
			}
		});

		this.applyLayout(split, false);
		this.focusedSide = side;
		document.body.addClass(ACTIVE_CLASS);
		this.updateStatusBar(side);
	}

	private unfocus(): void {
		if (!this.focusedSide) return;
		this.restoreDimensions(this.focusedSide);
		this.focusedSide = null;
		document.body.removeClass(ACTIVE_CLASS);
		this.updateStatusBar(null);
	}

	private restoreDimensions(side: Side): void {
		const saved = this.savedDimensions.get(side);
		const split = this.getSplit(side);
		if (!saved || !split) return;

		const sections = split.children;
		const fallback = 100 / sections.length;

		sections.forEach((section, i) => {
			section.dimension = saved[i] ?? fallback;
			section.containerEl.removeClass(COLLAPSED_CLASS);
			section.containerEl.removeClass(TARGET_CLASS);
			section.containerEl.removeAttribute("aria-hidden");
		});

		this.applyLayout(split);
		this.savedDimensions.delete(side);
	}

	private applyLayout(split: InternalSidedock, persist = true): void {
		if (typeof split.recomputeChildrenDimensions === "function") {
			split.recomputeChildrenDimensions();
		}
		if (persist) {
			this.app.workspace.requestSaveLayout();
		}
	}

	updateRibbonIcon(): void {
		if (this.settings.showRibbonIcon && !this.ribbonIconEl) {
			this.ribbonIconEl = this.addRibbonIcon(
				"panel-left",
				"Toggle focused sidebar",
				() => this.toggleFocus()
			);
		} else if (!this.settings.showRibbonIcon && this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}
	}

	private updateStatusBar(side: Side | null): void {
		if (!this.statusBarEl) return;
		if (side) {
			this.statusBarEl.setText(`Focused: ${side}`);
			this.statusBarEl.style.display = "";
		} else {
			this.statusBarEl.style.display = "none";
		}
	}

	private resolveSide(): Side {
		const leaf = this.app.workspace.getMostRecentLeaf();
		if (leaf) {
			const root = leaf.getRoot();
			if (root === this.app.workspace.leftSplit) return "left";
			if (root === this.app.workspace.rightSplit) return "right";
		}
		return "right";
	}

	private getSplit(side: Side): InternalSidedock | null {
		const split =
			side === "left"
				? this.app.workspace.leftSplit
				: this.app.workspace.rightSplit;
		if (!split) return null;
		return split as unknown as InternalSidedock;
	}

	private findActiveSectionIndex(split: InternalSidedock): number {
		const leaf = this.app.workspace.getMostRecentLeaf(
			split as unknown as WorkspaceSidedock
		);
		if (leaf) {
			const idx = this.findSectionIndexForLeaf(split, leaf);
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
