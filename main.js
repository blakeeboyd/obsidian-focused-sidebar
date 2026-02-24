"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FocusedSidebarPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// node_modules/monkey-around/dist/index.mjs
function around(obj, factories) {
  const removers = Object.keys(factories).map((key) => around1(obj, key, factories[key]));
  return removers.length === 1 ? removers[0] : function() {
    removers.forEach((r) => r());
  };
}
function around1(obj, method, createWrapper) {
  const inherited = obj[method], hadOwn = obj.hasOwnProperty(method), original = hadOwn ? inherited : function() {
    return Object.getPrototypeOf(obj)[method].apply(this, arguments);
  };
  let current = createWrapper(original);
  if (inherited)
    Object.setPrototypeOf(current, inherited);
  Object.setPrototypeOf(wrapper, current);
  obj[method] = wrapper;
  return remove;
  function wrapper(...args) {
    if (current === original && obj[method] === wrapper)
      remove();
    return current.apply(this, args);
  }
  function remove() {
    if (obj[method] === wrapper) {
      if (hadOwn)
        obj[method] = original;
      else
        delete obj[method];
    }
    if (current === original)
      return;
    current = original;
    Object.setPrototypeOf(wrapper, inherited || Function);
  }
}

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  indicatorStyle: "underline",
  useCustomColor: false,
  customColor: "#7440e4",
  showRibbonIcon: false
};
var STYLE_DESCRIPTIONS = {
  underline: "Bottom border only",
  highlight: "Background tint + bottom border",
  glow: "Soft glow behind the icon",
  "icon-only": "Icon color change only",
  button: "Colored button background"
};
var FocusedSidebarSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", {
      text: 'Collapse all sidebar sections except one. Double-click a tab header, right-click for "Focus section," or use the command palette.',
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(containerEl).setName("Show ribbon icon").setDesc("Show a toggle button in the left ribbon").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showRibbonIcon).onChange(async (value) => {
        this.plugin.settings.showRibbonIcon = value;
        await this.plugin.saveSettings();
        this.plugin.updateRibbonIcon();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Indicator style").setDesc("How the focused section's tab is highlighted").addDropdown(
      (dropdown) => dropdown.addOptions(STYLE_DESCRIPTIONS).setValue(this.plugin.settings.indicatorStyle).onChange(async (value) => {
        this.plugin.settings.indicatorStyle = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Use custom color").setDesc(
      "Override the accent color with a custom color for the indicator"
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.useCustomColor).onChange(async (value) => {
        this.plugin.settings.useCustomColor = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    if (this.plugin.settings.useCustomColor) {
      new import_obsidian.Setting(containerEl).setName("Custom color").setDesc("Pick a color for the focus indicator").addColorPicker(
        (picker) => picker.setValue(this.plugin.settings.customColor).onChange(async (value) => {
          this.plugin.settings.customColor = value;
          await this.plugin.saveSettings();
        })
      ).addButton(
        (button) => button.setButtonText("Reset").onClick(async () => {
          this.plugin.settings.customColor = DEFAULT_SETTINGS.customColor;
          await this.plugin.saveSettings();
          this.display();
        })
      );
    }
  }
};

// src/main.ts
var COLLAPSED_CLASS = "focused-sidebar-collapsed";
var ACTIVE_CLASS = "focused-sidebar-active";
var TARGET_CLASS = "focused-sidebar-target";
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}`;
}
function getResolvedColor(property, fallback) {
  const raw = getComputedStyle(document.body).getPropertyValue(property).trim();
  if (!raw) return fallback;
  if (raw.startsWith("#")) return raw;
  const tmp = document.createElement("div");
  tmp.style.color = raw;
  document.body.appendChild(tmp);
  const computed = getComputedStyle(tmp).color;
  tmp.remove();
  const m = computed.match(/(\d+)/g);
  if (!m) return fallback;
  return "#" + m.slice(0, 3).map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
}
var FocusedSidebarPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.savedDimensions = /* @__PURE__ */ new Map();
    this.focusedSide = null;
    this.unpatchMenu = null;
    this.dblClickHandler = null;
    this.statusBarEl = null;
    this.ribbonIconEl = null;
    this.lastInteractedSide = "left";
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new FocusedSidebarSettingTab(this.app, this));
    this.addCommand({
      id: "toggle-focused-sidebar",
      name: "Toggle focused sidebar",
      callback: () => this.toggleFocus()
    });
    this.addCommand({
      id: "focus-left-sidebar",
      name: "Focus left sidebar",
      callback: () => this.toggleFocusSide("left")
    });
    this.addCommand({
      id: "focus-right-sidebar",
      name: "Focus right sidebar",
      callback: () => this.toggleFocusSide("right")
    });
    this.addCommand({
      id: "cycle-focused-section",
      name: "Cycle to next section",
      callback: () => this.cycleFocus()
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
    this.registerCssChange();
  }
  onunload() {
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
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
    if (this.focusedSide) this.applyStyleAttrs();
  }
  async saveSettings() {
    await this.saveData(this.settings);
    if (this.focusedSide) this.applyStyleAttrs();
  }
  /** Push settings into CSS custom properties and a data attribute on body. */
  applyStyleAttrs() {
    const el = document.body;
    el.dataset.focusedSidebarStyle = this.settings.indicatorStyle;
    const color = this.settings.useCustomColor ? this.settings.customColor : getResolvedColor("--interactive-accent", "#7440e4");
    el.style.setProperty("--focused-sidebar-color", color);
    el.style.setProperty("--focused-sidebar-color-rgb", hexToRgb(color));
  }
  removeStyleAttrs() {
    delete document.body.dataset.focusedSidebarStyle;
    document.body.style.removeProperty("--focused-sidebar-color");
    document.body.style.removeProperty("--focused-sidebar-color-rgb");
  }
  patchMenu() {
    const plugin = this;
    this.unpatchMenu = around(import_obsidian2.Menu.prototype, {
      showAtMouseEvent(old) {
        return function(evt) {
          plugin.maybeAddFocusItem(this, evt);
          return old.call(this, evt);
        };
      }
    });
  }
  registerDblClick() {
    this.dblClickHandler = (evt) => {
      const hit = this.resolveTabHit(evt);
      if (!hit) return;
      evt.stopPropagation();
      const { side, split, sectionIndex, clickedLeaf } = hit;
      this.lastInteractedSide = side;
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
    document.addEventListener("dblclick", this.dblClickHandler, true);
  }
  registerCssChange() {
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        if (this.focusedSide && !this.settings.useCustomColor) {
          this.applyStyleAttrs();
        }
      })
    );
  }
  registerLayoutChange() {
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
  resolveTabHit(evt) {
    const target = evt.target;
    if (!target) return null;
    const tabHeader = target.closest(".workspace-tab-header");
    if (!tabHeader) return null;
    const tabsEl = tabHeader.closest(".workspace-tabs");
    if (!tabsEl) return null;
    const sidebarEl = tabsEl.closest(
      ".mod-left-split, .mod-right-split"
    );
    if (!sidebarEl) return null;
    const side = sidebarEl.classList.contains("mod-left-split") ? "left" : "right";
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
    const allHeaders = tabHeaderContainer ? Array.from(
      tabHeaderContainer.querySelectorAll(
        ".workspace-tab-header"
      )
    ) : [];
    const tabIndex = allHeaders.indexOf(tabHeader);
    const clickedLeaf = tabIndex >= 0 && tabIndex < section.children.length ? section.children[tabIndex] : null;
    return { side, split, sectionIndex, clickedLeaf };
  }
  maybeAddFocusItem(menu, evt) {
    const hit = this.resolveTabHit(evt);
    if (!hit) return;
    const { side, split, sectionIndex, clickedLeaf } = hit;
    this.lastInteractedSide = side;
    const isFocused = this.focusedSide === side;
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle(isFocused ? "Unfocus section" : "Focus section").setIcon(isFocused ? "minimize" : "maximize").onClick(() => {
        if (isFocused) {
          this.unfocus();
        } else {
          this.focusSection(side, split, sectionIndex);
        }
        if (clickedLeaf) {
          this.app.workspace.setActiveLeaf(clickedLeaf, {
            focus: true
          });
        }
      });
    });
  }
  toggleFocus() {
    const side = this.resolveSide();
    const split = this.getSplit(side);
    if (!split) {
      new import_obsidian2.Notice("No sidebar found.");
      return;
    }
    const sections = split.children;
    if (sections.length <= 1) {
      new import_obsidian2.Notice("Sidebar has only one section.");
      return;
    }
    if (this.focusedSide === side) {
      this.unfocus();
      return;
    }
    const activeIndex = this.findActiveSectionIndex(split);
    this.focusSection(side, split, activeIndex);
  }
  toggleFocusSide(side) {
    const split = this.getSplit(side);
    if (!split) {
      new import_obsidian2.Notice("No sidebar found.");
      return;
    }
    const sections = split.children;
    if (sections.length <= 1) {
      new import_obsidian2.Notice("Sidebar has only one section.");
      return;
    }
    if (this.focusedSide === side) {
      this.unfocus();
      return;
    }
    const activeIndex = this.findActiveSectionIndex(split);
    this.focusSection(side, split, activeIndex);
  }
  cycleFocus() {
    if (!this.focusedSide) {
      new import_obsidian2.Notice("No section is focused.");
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
  focusSection(side, split, sectionIndex) {
    const sections = split.children;
    if (sectionIndex < 0 || sectionIndex >= sections.length) return;
    if (this.focusedSide && this.focusedSide !== side) {
      this.restoreDimensions(this.focusedSide);
    }
    if (!this.savedDimensions.has(side)) {
      this.savedDimensions.set(
        side,
        sections.map((s) => s.dimension)
      );
    }
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
    this.applyStyleAttrs();
    document.body.addClass(ACTIVE_CLASS);
    this.updateStatusBar(side);
  }
  unfocus() {
    if (!this.focusedSide) return;
    this.restoreDimensions(this.focusedSide);
    this.focusedSide = null;
    document.body.removeClass(ACTIVE_CLASS);
    this.removeStyleAttrs();
    this.updateStatusBar(null);
  }
  restoreDimensions(side) {
    const saved = this.savedDimensions.get(side);
    const split = this.getSplit(side);
    if (!saved || !split) return;
    const sections = split.children;
    const fallback = 100 / sections.length;
    sections.forEach((section, i) => {
      var _a;
      section.dimension = (_a = saved[i]) != null ? _a : fallback;
      section.containerEl.removeClass(COLLAPSED_CLASS);
      section.containerEl.removeClass(TARGET_CLASS);
      section.containerEl.removeAttribute("aria-hidden");
    });
    this.applyLayout(split);
    this.savedDimensions.delete(side);
  }
  applyLayout(split, persist = true) {
    if (typeof split.recomputeChildrenDimensions === "function") {
      split.recomputeChildrenDimensions();
    }
    if (persist) {
      this.app.workspace.requestSaveLayout();
    }
  }
  updateRibbonIcon() {
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
  updateStatusBar(side) {
    if (!this.statusBarEl) return;
    if (side) {
      this.statusBarEl.setText(`Focused: ${side}`);
      this.statusBarEl.style.display = "";
    } else {
      this.statusBarEl.style.display = "none";
    }
  }
  resolveSide() {
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (leaf) {
      const root = leaf.getRoot();
      if (root === this.app.workspace.leftSplit) return "left";
      if (root === this.app.workspace.rightSplit) return "right";
    }
    return this.lastInteractedSide;
  }
  getSplit(side) {
    const split = side === "left" ? this.app.workspace.leftSplit : this.app.workspace.rightSplit;
    if (!split) return null;
    return split;
  }
  findActiveSectionIndex(split) {
    const leaf = this.app.workspace.getMostRecentLeaf(
      split
    );
    if (leaf) {
      const idx = this.findSectionIndexForLeaf(split, leaf);
      if (idx !== -1) return idx;
    }
    return 0;
  }
  findSectionIndexForLeaf(split, leaf) {
    for (let i = 0; i < split.children.length; i++) {
      if (split.children[i].children.some((child) => child === leaf)) {
        return i;
      }
    }
    return -1;
  }
};
