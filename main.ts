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
	generateReferenceLibrary,
} from "./references"


interface BibliosidianSettings {
	mySetting: string;
	referenceSourcePropertiesPrefix: string;
	referenceSourceBibTex: string
	referenceSubdirectoryRoot: string
	isSubdirectorizeReferencesLexically: boolean
	authorsParentFolderPath: string
	isSubdirectorizeAuthorsLexically: boolean
	isCreateAuthorPages: boolean,
}

const DEFAULT_SETTINGS: Partial<BibliosidianSettings> = {
	mySetting: 'default',
	referenceSourcePropertiesPrefix: "source-",
	referenceSourceBibTex: "entry-bibtex",
	referenceSubdirectoryRoot: _path.join("sources", "references"),
	isSubdirectorizeReferencesLexically: true,
	authorsParentFolderPath: _path.join("sources", "authors"),
	isSubdirectorizeAuthorsLexically: true,
	isCreateAuthorPages: true,
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
		new Setting(containerEl)
			.setName("Source BibTex property name")
			.setDesc(`
Name of text field on note that to track associated BibTeX data.
			`)
			.addText(text => text
				.setPlaceholder("(YAML frontmatter property name, e.g. 'source-bibtex')")
				.setValue(this.plugin.settings.referenceSourceBibTex)
				.onChange(async (value) => {
					this.plugin.settings.referenceSourceBibTex = value;
					await this.plugin.saveSettings();
		}));
		new Setting(containerEl)
			.setName("References folder")
			.setDesc(`
Path to folder of reference notes.
			`)
			.addText(text => text
				.setPlaceholder("(E.g. 'sources/references')")
				.setValue(this.plugin.settings.referenceSubdirectoryRoot)
				.onChange(async (value) => {
					this.plugin.settings.referenceSubdirectoryRoot = value;
					await this.plugin.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Organize reference into subdirectories based on citekey")
			.setDesc("Enable or disable lexical organization of references into subdirectories.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isSubdirectorizeReferencesLexically)
				.onChange(async (value) => {
					this.plugin.settings.isSubdirectorizeReferencesLexically = value;
					await this.plugin.saveSettings();
        }));


		new Setting(containerEl)
			.setName("Authors folder")
			.setDesc(`
Path to folder of author notes.
			`)
			.addText(text => text
				.setPlaceholder("(E.g. 'sources/authors')")
				.setValue(this.plugin.settings.authorsParentFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.authorsParentFolderPath = value;
					await this.plugin.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Organize authors into subdirectories")
			.setDesc("Enable or disable lexical organization of authors into subdirectories.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isSubdirectorizeAuthorsLexically)
				.onChange(async (value) => {
					this.plugin.settings.isSubdirectorizeAuthorsLexically = value;
					await this.plugin.saveSettings();
        }));
		new Setting(containerEl)
		.setName("Create author notes automatically")
		.setDesc("Enable or disable creation or updating of linked author notes when creating or updating reference notes.")
		.addToggle(toggle => toggle
				   .setValue(this.plugin.settings.isCreateAuthorPages)
				   .onChange(async (value) => {
					   this.plugin.settings.isCreateAuthorPages = value;
					   await this.plugin.saveSettings();
		}));
	}


}


export default class Bibliosidian extends Plugin {
	settings: BibliosidianSettings;

	async onload() {
		await this.loadSettings();


		this.addRibbonIcon("library-square", "Update multiple references from a BibTeX bibliography database file", () => {
			this.updateReferenceLibraryFromBibTex()
		});
		this.addRibbonIcon("book-up-2", "Create or update reference note from BibTeX data", () => {
			this.updateReferenceNoteFromBibTex()
		});


		this.addCommand({
			id: 'bibliosidian-update-reference-from-bibtex',
			name: 'Update active file properties from BibTeX',
			callback: this.updateReferenceNoteFromBibTex,
		});
		this.addCommand({
			id: 'bibliosidian-update-reference-library-from-bibtex',
			name: 'Update multiple references from a BibTeX bibliography database file',
			callback: this.updateReferenceLibraryFromBibTex,
		});
		this.addCommand({
			id: 'bibliosidian-update-active-file-from-bibtex',
			name: 'Update active file properties from BibTeX',
			callback: this.updateActiveFilePropertiesFromBibTex,
		});



		this.addSettingTab(new BibliosidianSettingTab(this.app, this));
	}

	updateReferenceLibraryFromBibTex() {
		let sourceBibTex = ""
		generateReferenceLibrary(
			this.app,
			sourceBibTex,
			this.settings.referenceSourcePropertiesPrefix,
			this.settings.referenceSubdirectoryRoot,
			this.settings.isSubdirectorizeReferencesLexically,
			this.settings.authorsParentFolderPath,
			this.settings.isSubdirectorizeAuthorsLexically,
			this.settings.isCreateAuthorPages,
		)

	}

	updateReferenceNoteFromBibTex(isOpenNote: boolean = true) {
		let defaultBibTex = ""
		createReferenceNote(
			this.app,
			defaultBibTex,
			"",
			undefined,
			this.settings.referenceSourcePropertiesPrefix,
			this.settings.referenceSubdirectoryRoot,
			this.settings.isSubdirectorizeReferencesLexically,
			this.settings.authorsParentFolderPath,
			this.settings.isSubdirectorizeAuthorsLexically,
			this.settings.isCreateAuthorPages,
			isOpenNote,
		)
	}

	updateActiveFilePropertiesFromBibTex(isOpenNote: boolean = false) {
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
			this.settings.isSubdirectorizeAuthorsLexically,
			this.settings.isCreateAuthorPages,
			isOpenNote,
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

