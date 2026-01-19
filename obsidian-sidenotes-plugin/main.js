const obsidian = require("obsidian");

const DEFAULT_SETTINGS = {
  notePath: "SideNotes.md",
  panelWidth: 360,
  edgeThreshold: 24,
  peekWidth: 12,
};

class SideNotesSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl("h2", { text: "SideNotes Panel" });

    new obsidian.Setting(containerEl)
      .setName("Note path")
      .setDesc("Path to the note that should appear in the side panel.")
      .addText((text) =>
        text
          .setPlaceholder("SideNotes.md")
          .setValue(this.plugin.settings.notePath)
          .onChange(async (value) => {
            this.plugin.settings.notePath = value;
            await this.plugin.saveSettings();
            await this.plugin.ensureLeaf();
          })
      );

    new obsidian.Setting(containerEl)
      .setName("Panel width")
      .setDesc("Width of the slide-out panel in pixels.")
      .addSlider((slider) =>
        slider
          .setLimits(240, 640, 20)
          .setValue(this.plugin.settings.panelWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.panelWidth = value;
            await this.plugin.saveSettings();
          })
      );

    new obsidian.Setting(containerEl)
      .setName("Edge activation distance")
      .setDesc("How close the cursor needs to be to the right edge to open the panel.")
      .addSlider((slider) =>
        slider
          .setLimits(8, 96, 4)
          .setValue(this.plugin.settings.edgeThreshold)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.edgeThreshold = value;
            await this.plugin.saveSettings();
          })
      );

    new obsidian.Setting(containerEl)
      .setName("Peek width")
      .setDesc("How much of the panel remains visible when hidden.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 40, 2)
          .setValue(this.plugin.settings.peekWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.peekWidth = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

module.exports = class SideNotesPlugin extends obsidian.Plugin {
  constructor(app, manifest) {
    super(app, manifest);
    this.settings = DEFAULT_SETTINGS;
    this.leaf = null;
    this.isPointerInPanel = false;
    this.isFocused = false;
    this.isNearEdge = false;
  }

  async onload() {
    await this.loadSettings();
    this.applyCssVariables();
    this.addSettingTab(new SideNotesSettingTab(this.app, this));

    await this.ensureLeaf();
    this.registerDomEvent(window, "mousemove", (event) => {
      this.isNearEdge = window.innerWidth - event.clientX <= this.settings.edgeThreshold;
      this.updateOpenState();
    });
  }

  onunload() {
    if (this.leaf) {
      this.leaf.detach();
      this.leaf = null;
    }
    document.body.classList.remove("sidenotes-open");
  }

  async ensureLeaf() {
    if (this.leaf) {
      return;
    }

    const file = await this.ensureNoteFile();
    const leaf = this.app.workspace.getLeaf("window");
    await leaf.openFile(file, { active: false });

    leaf.containerEl.addClass("sidenotes-panel");
    this.leaf = leaf;

    this.registerDomEvent(leaf.containerEl, "mouseenter", () => {
      this.isPointerInPanel = true;
      this.updateOpenState();
    });

    this.registerDomEvent(leaf.containerEl, "mouseleave", () => {
      this.isPointerInPanel = false;
      this.updateOpenState();
    });

    this.registerDomEvent(leaf.containerEl, "focusin", () => {
      this.isFocused = true;
      this.updateOpenState();
    });

    this.registerDomEvent(leaf.containerEl, "focusout", () => {
      this.isFocused = false;
      this.updateOpenState();
    });
  }

  async ensureNoteFile() {
    const trimmedPath = this.settings.notePath.trim();
    const path = trimmedPath.length > 0 ? trimmedPath : DEFAULT_SETTINGS.notePath;
    const existing = this.app.vault.getAbstractFileByPath(path);

    if (existing instanceof obsidian.TFile) {
      return existing;
    }

    return this.app.vault.create(path, "# SideNotes\n\nStart writing your quick note here.\n");
  }

  updateOpenState() {
    const shouldOpen = this.isNearEdge || this.isPointerInPanel || this.isFocused;
    document.body.classList.toggle("sidenotes-open", shouldOpen);
  }

  applyCssVariables() {
    document.body.style.setProperty("--sidenotes-width", `${this.settings.panelWidth}px`);
    document.body.style.setProperty("--sidenotes-peek", `${this.settings.peekWidth}px`);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyCssVariables();
  }
};
