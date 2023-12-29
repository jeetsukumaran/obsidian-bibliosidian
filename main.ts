import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting
} from 'obsidian';

import {
	generateAuthorLinks,
	updateYAMLProperty,
} from "./references"


interface BibliosidianSettings {
	mySetting: string;
	referenceSourcePropertiesPrefix: string;
}

const DEFAULT_SETTINGS: BibliosidianSettings = {
	mySetting: 'default',
	referenceSourcePropertiesPrefix: "source-",
}

export default class Bibliosidian extends Plugin {
	settings: BibliosidianSettings;

	async onload() {
		await this.loadSettings();

		// this.addRibbonIcon("package-plus", "Activate view", () => {
		this.addRibbonIcon("book-key", "Update properties from reference data", () => {
			let activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				return
			}
			let results = generateAuthorLinks(
				`
				  @Book{sole2000,
					author           = {Solé, Ricard V. and Goodwin, Brian C.},
					date             = {2000},
					title            = {Signs of life},
					isbn             = {0465019277},
					location         = {New York, NY},
					pagetotal        = {322},
					publisher        = {Basic Books},
					subtitle         = {How complexity pervades biology},
					modificationdate = {2023-12-27T00:46:40},
					ppn_gvk          = {1619306891},
					}
				`,
				"sole2000",
				"sources/authors",
			)
			if (results) {
				updateYAMLProperty(
					this.app,
					activeFile.path,
					`${this.settings.referenceSourcePropertiesPrefix}authors`,
					results,
				)
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new BibliosidianSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class BibliosidianSettingTab extends PluginSettingTab {
	plugin: Bibliosidian;

	constructor(app: App, plugin: Bibliosidian) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
