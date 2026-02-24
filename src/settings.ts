import { App, PluginSettingTab, Setting } from "obsidian";
import type FocusedSidebarPlugin from "./main";

export type IndicatorStyle = "highlight" | "underline" | "glow" | "icon-only" | "button";

export interface FocusedSidebarSettings {
	indicatorStyle: IndicatorStyle;
	useCustomColor: boolean;
	customColor: string;
	showRibbonIcon: boolean;
}

export const DEFAULT_SETTINGS: FocusedSidebarSettings = {
	indicatorStyle: "underline",
	useCustomColor: false,
	customColor: "#7f6df2",
	showRibbonIcon: true,
};

const STYLE_DESCRIPTIONS: Record<IndicatorStyle, string> = {
	underline: "Bottom border only",
	highlight: "Background tint + bottom border",
	glow: "Soft glow behind the icon",
	"icon-only": "Icon color change only",
	button: "Colored button background",
};

export class FocusedSidebarSettingTab extends PluginSettingTab {
	plugin: FocusedSidebarPlugin;

	constructor(app: App, plugin: FocusedSidebarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("p", {
			text: "Collapse all sidebar sections except one. Double-click a tab header, right-click for \"Focus this section,\" or use the command palette.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Show ribbon icon")
			.setDesc("Show a toggle button in the left ribbon")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showRibbonIcon)
					.onChange(async (value) => {
						this.plugin.settings.showRibbonIcon = value;
						await this.plugin.saveSettings();
						this.plugin.updateRibbonIcon();
					})
			);

		new Setting(containerEl)
			.setName("Indicator style")
			.setDesc("How the focused section's tab is highlighted")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(STYLE_DESCRIPTIONS)
					.setValue(this.plugin.settings.indicatorStyle)
					.onChange(async (value) => {
						this.plugin.settings.indicatorStyle =
							value as IndicatorStyle;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Use custom color")
			.setDesc(
				"Override the accent color with a custom color for the indicator"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useCustomColor)
					.onChange(async (value) => {
						this.plugin.settings.useCustomColor = value;
						await this.plugin.saveSettings();
						this.display(); // Re-render to show/hide color picker
					})
			);

		if (this.plugin.settings.useCustomColor) {
			new Setting(containerEl)
				.setName("Custom color")
				.setDesc("Pick a color for the focus indicator")
				.addColorPicker((picker) =>
					picker
						.setValue(this.plugin.settings.customColor)
						.onChange(async (value) => {
							this.plugin.settings.customColor = value;
							await this.plugin.saveSettings();
						})
				);
		}
	}
}
