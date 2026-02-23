import { App, PluginSettingTab, Setting } from "obsidian";
import type FocusedSidebarPlugin from "./main";

export type IndicatorStyle = "highlight" | "underline" | "dot" | "glow" | "icon-only" | "button";

export interface FocusedSidebarSettings {
	indicatorStyle: IndicatorStyle;
	useCustomColor: boolean;
	customColor: string;
}

export const DEFAULT_SETTINGS: FocusedSidebarSettings = {
	indicatorStyle: "highlight",
	useCustomColor: false,
	customColor: "#7f6df2",
};

const STYLE_DESCRIPTIONS: Record<IndicatorStyle, string> = {
	highlight: "Background tint + underline",
	underline: "Bottom border only",
	dot: "Colored dot above the icon",
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
