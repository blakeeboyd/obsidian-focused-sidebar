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
var import_obsidian = require("obsidian");

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

// src/main.ts
var COLLAPSED_CLASS = "focused-sidebar-collapsed";
var ACTIVE_CLASS = "focused-sidebar-active";
var FocusedSidebarPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.savedDimensions = /* @__PURE__ */ new Map();
    this.focusedSide = null;
    this.unpatchMenu = null;
  }
  async onload() {
    this.addCommand({
      id: "toggle-focused-sidebar",
      name: "Toggle focused sidebar",
      callback: () => this.toggleFocus()
    });
    this.addRibbonIcon("maximize", "Toggle focused sidebar", () => {
      this.toggleFocus();
    });
    this.patchMenu();
  }
  onunload() {
    if (this.focusedSide) {
      this.restoreDimensions(this.focusedSide);
      document.body.removeClass(ACTIVE_CLASS);
    }
    if (this.unpatchMenu) {
      this.unpatchMenu();
      this.unpatchMenu = null;
    }
  }
  patchMenu() {
    const plugin = this;
    this.unpatchMenu = around(import_obsidian.Menu.prototype, {
      showAtMouseEvent(old) {
        return function(evt) {
          plugin.maybeAddFocusItem(this, evt);
          return old.call(this, evt);
        };
      }
    });
  }
  maybeAddFocusItem(menu, evt) {
    const target = evt.target;
    if (!target) return;
    const tabHeader = target.closest(".workspace-tab-header");
    if (!tabHeader) return;
    const tabsEl = tabHeader.closest(".workspace-tabs");
    if (!tabsEl) return;
    const sidebarEl = tabsEl.closest(
      ".mod-left-split, .mod-right-split"
    );
    if (!sidebarEl) return;
    const side = sidebarEl.classList.contains("mod-left-split") ? "left" : "right";
    const split = this.getSplit(side);
    if (!split || split.children.length <= 1) return;
    const sectionIndex = split.children.findIndex(
      (s) => s.containerEl === tabsEl
    );
    if (sectionIndex === -1) return;
    const isFocused = this.focusedSide === side;
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
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle(isFocused ? "Unfocus sidebar" : "Focus this section").setIcon(isFocused ? "minimize" : "maximize").onClick(() => {
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
      new import_obsidian.Notice("No sidebar found.");
      return;
    }
    const sections = split.children;
    if (sections.length <= 1) {
      new import_obsidian.Notice("Sidebar has only one section.");
      return;
    }
    if (this.focusedSide === side) {
      this.unfocus();
      return;
    }
    const activeIndex = this.findActiveSectionIndex(split);
    this.focusSection(side, split, activeIndex);
  }
  focusSection(side, split, sectionIndex) {
    const sections = split.children;
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
      } else {
        section.dimension = 0;
        section.containerEl.addClass(COLLAPSED_CLASS);
      }
    });
    this.applyLayout(split);
    this.focusedSide = side;
    document.body.addClass(ACTIVE_CLASS);
  }
  unfocus() {
    if (!this.focusedSide) return;
    this.restoreDimensions(this.focusedSide);
    this.focusedSide = null;
    document.body.removeClass(ACTIVE_CLASS);
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
    });
    this.applyLayout(split);
    this.savedDimensions.delete(side);
  }
  applyLayout(split) {
    if (typeof split.recomputeChildrenDimensions === "function") {
      split.recomputeChildrenDimensions();
    }
    this.app.workspace.requestSaveLayout();
  }
  resolveSide() {
    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf) {
      const root = activeLeaf.getRoot();
      if (root === this.app.workspace.leftSplit) return "left";
      if (root === this.app.workspace.rightSplit) return "right";
    }
    return "right";
  }
  getSplit(side) {
    const split = side === "left" ? this.app.workspace.leftSplit : this.app.workspace.rightSplit;
    return split;
  }
  findActiveSectionIndex(split) {
    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf) {
      const idx = this.findSectionIndexForLeaf(split, activeLeaf);
      if (idx !== -1) return idx;
    }
    const recent = this.app.workspace.getMostRecentLeaf(split);
    if (recent) {
      const idx = this.findSectionIndexForLeaf(split, recent);
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
