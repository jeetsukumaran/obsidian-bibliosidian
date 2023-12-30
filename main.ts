import {
	App,
	CachedMetadata,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting
} from 'obsidian';

import * as _path from "path";

import {
	createReferenceNote,
} from "./references"


interface BibliosidianSettings {
	mySetting: string;
	referenceSourcePropertiesPrefix: string;
	referenceSourceBibTex: string
	referenceSubdirectoryRoot: string
	isSubdirectorizeReferencesLexically: boolean
	authorsParentFolderPath: string
}

const DEFAULT_SETTINGS: BibliosidianSettings = {
	mySetting: 'default',
	referenceSourcePropertiesPrefix: "source-",
	referenceSourceBibTex: "entry-bibtex",
	referenceSubdirectoryRoot: _path.join("sources", "references"),
	isSubdirectorizeReferencesLexically: false,
	authorsParentFolderPath: _path.join("sources", "authors"),
}


export default class Bibliosidian extends Plugin {
	settings: BibliosidianSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("book-plus", "Update properties from reference data", () => {
			this.updateActiveFilePropertiesFromBibTex()
		});
		this.addSettingTab(new BibliosidianSettingTab(this.app, this));
	}

	createReferenceNoteFromBibTex() {
		let defaultBibTex = ""
		createReferenceNote(
			this.app,
			defaultBibTex,
			"",
			undefined,
			this.settings.referenceSourcePropertiesPrefix,
			_path.join("sources", "references"),
			false,
			_path.join("sources", "authors"),
		)

	}

	updateActiveFilePropertiesFromBibTex() {
		let activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			return
		}
		let defaultBibTex = ""
		let frontmatter = app.metadataCache?.getFileCache(activeFile)?.frontmatter
		if (frontmatter) {
			defaultBibTex = frontmatter?.["entry-bibtex"] || defaultBibTex
		}
		createReferenceNote(
			this.app,
			defaultBibTex,
			activeFile.path,
			undefined,
			this.settings.referenceSourcePropertiesPrefix,
			this.settings.referenceSubdirectoryRoot,
			this.settings.isSubdirectorizeReferencesLexically,
			this.settings.authorsParentFolderPath,
		)
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
			.setName("Source BibTex property name")
			.setDesc(`
Name of text field on note that to track associated BibTeX data.
			`)
			.addText(text => text
				.setPlaceholder("(YAML frontmatter property name, e.g. 'source-bibtex'")
				.setValue(this.plugin.settings.referenceSourceBibTex)
				.onChange(async (value) => {
					this.plugin.settings.referenceSourceBibTex = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Source bibliographic data property name prefix")
			.setDesc(`
This will be prefixed to the normalized bibliographic (YAML frontmatter properties) data fields for reference bibliographic data.
For example, if set to 'source-', the frontmatter YAML field will be 'source-authors' instead of just 'authors'.
Better namespacing will come when Obsidian supports nested frontmatter YAML objects.
			`)
			.addText(text => text
				.setPlaceholder("(e.g., 'source-')")
				.setValue(this.plugin.settings.referenceSourcePropertiesPrefix)
				.onChange(async (value) => {
					this.plugin.settings.referenceSourcePropertiesPrefix = value;
					await this.plugin.saveSettings();
				}));

	}
}
