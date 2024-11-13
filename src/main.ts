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
	FilePropertyData,
	parseYaml,
	stringifyYaml,
	createFilePropertyDataTable,
} from "./fileProperties";

import {
    ImportHoldingModal,
} from "./attachments";

import {
	createBiblioNote,
	generateBiblioNoteLibrary,
	ProcessedBibTexResult,
} from "./bibliosidian";

import {
    CitationList,
} from "./CitationList";

import {
    DataService,
} from "./DataService";

import {
	BibliosidianSettings,
    DEFAULT_SETTINGS,
} from "./settings";

interface Footnote {
    original: string;
    footnote: string;
    index: number;
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

		containerEl.createEl("h1", { text: "Bibliosidian settings" })

		containerEl.createEl("h2", { text: "Namespaces" })

		new Setting(containerEl)
			.setName("Source bibliographic data property name prefix")
			.setDesc(
                "This will be prefixed to the normalized bibliographic (YAML frontmatter properties)"
                + " data fields. For example, if set to 'source-',"
                + " the frontmatter YAML field will be 'source-authors' instead of just 'authors'. "
			)
			.addText(text => text
				.setPlaceholder("(e.g., 'source-')")
				.setValue(this.plugin.settings.biblioNoteSourcePropertiesPrefix)
				.onChange(async (value) => {
					this.plugin.settings.biblioNoteSourcePropertiesPrefix = value;
					await this.plugin.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Source BibTeX property name")
			.setDesc(` Property on bibliographic note to store source BibTeX data. `)
			.addText(text => text
				.setPlaceholder("(YAML frontmatter property name, e.g. 'source-bibtex')")
				.setValue(this.plugin.settings.biblioNoteSourceBibTex)
				.onChange(async (value) => {
					this.plugin.settings.biblioNoteSourceBibTex = value;
					await this.plugin.saveSettings();
		}));

		containerEl.createEl("h2", { text: "Bibliographic notes" })

		new Setting(containerEl)
			.setName("Bibliographic notes folder")
			.setDesc("Path to folder of bibliographic notes.")
			.addText(text => text
				.setPlaceholder("(E.g. 'sources/references')")
				.setValue(this.plugin.settings.biblioNoteSubdirectoryRoot)
				.onChange(async (value) => {
					this.plugin.settings.biblioNoteSubdirectoryRoot = value;
					await this.plugin.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Organize bibliographic notes into subdirectories based on citation key")
			.setDesc("Enable or disable lexical organization of bibliographic notes into subdirectories.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isSubdirectorizeBiblioNotesLexically)
				.onChange(async (value) => {
					this.plugin.settings.isSubdirectorizeBiblioNotesLexically = value;
					await this.plugin.saveSettings();
        }));

		new Setting(containerEl)
			.setName("Create author notes automatically")
			.setDesc("Enable or disable creation or updating of linked author notes when creating or updating bibliographic notes.")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.isCreateAuthorPages)
					.onChange(async (value) => {
						this.plugin.settings.isCreateAuthorPages = value;
						await this.plugin.saveSettings();
		}));

		this.manageAdditionalPropertiesSettings(
			containerEl,
			"biblioNoteAdditionalMetadata",
		)

		containerEl.createEl("h2", { text: "Authors" })

		new Setting(containerEl)
			.setName("Authors folder")
			.setDesc("Path to folder of author notes.")
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
			.setName("Bibliographic note link property name:")
			.setDesc("Name of property on author note linking to associated bibliographic notes.")
			.addText(text => text
				.setPlaceholder("(E.g. 'references', 'works', 'bibliographies')")
				.setValue(this.plugin.settings.authorBiblioNoteOutlinkPropertyName)
				.onChange(async (value) => {
					this.plugin.settings.authorBiblioNoteOutlinkPropertyName = value
					await this.plugin.saveSettings();
		}));

		this.manageAdditionalPropertiesSettings(
			containerEl,
			"authorsAdditionalMetadata",
		)

		containerEl.createEl("h2", { text: "Holdings" })

		new Setting(containerEl)
			.setName("Holdings folder")
			.setDesc("Path to parent or root folder of holdings (attachments). Leave blank to store alongside bibliographic file.")
			.addText(text => text
				.setPlaceholder("(E.g. 'sources/references')")
				.setValue(this.plugin.settings.holdingsSubdirectoryRoot)
				.onChange(async (value) => {
					this.plugin.settings.holdingsSubdirectoryRoot = value;
					await this.plugin.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Holdings outlink property name:")
			.setDesc("Name of property on bibliographic note to update with link to imported holdings.")
			.addText(text => text
				.setPlaceholder("(E.g. 'attachments' or 'pdfs')")
				.setValue(this.plugin.settings.holdingsPropertyName)
				.onChange(async (value) => {
					this.plugin.settings.holdingsPropertyName = value;
					await this.plugin.saveSettings();
		}));

	}


	manageAdditionalPropertiesSettings(
		containerEl: HTMLElement,
		settingsPropertyName: "biblioNoteAdditionalMetadata" | "authorsAdditionalMetadata",
		settingsPropertyDisplayName: string = "Additional properties (YAML)",
		settingsPropertyParameterInitialDescription: string = "Other metadata properties to be updated specified in YAML.",
		settingsPropertyParameterPlaceholder: string = "(E.g., 'type: literature)",
	) {
			let currentAdditionalPropertiesString: string = "";
			if (this.plugin.settings[settingsPropertyName]) {
				let cachedValue: FilePropertyData = this.plugin.settings[settingsPropertyName] as FilePropertyData
				if (cachedValue) {
					currentAdditionalPropertiesString = stringifyYaml(cachedValue)
				}
			}
			let refPropertiesSetting = new Setting(containerEl)
			.setName(settingsPropertyDisplayName)
			.setDesc(settingsPropertyParameterInitialDescription)
			.addTextArea(text => {
				text.setPlaceholder(settingsPropertyParameterPlaceholder)
				.setValue(currentAdditionalPropertiesString);
				text.inputEl.style.height = "8rem"
				text.inputEl.addEventListener("blur", async () => {
					try {
						let refProperties: FilePropertyData = parseYaml(text.getValue());
						// refPropertiesSetting.setDesc("YAML parsed successfully. Recognized fields: " + Object.keys(refProperties).join(", "));
						// refPropertiesSetting.setDesc(`YAML parsed successfully: ${refProperties}`)
						refPropertiesSetting.descEl.empty()
						createFilePropertyDataTable(refPropertiesSetting.descEl, refProperties)
						// this.plugin.settings.biblioNoteAdditionalMetadata = stringifyYaml(refProperties);
						// this.plugin.settings[settingsPropertyName] = refProperties;
						this.plugin.settings[settingsPropertyName] = refProperties
						await this.plugin.saveSettings();
					} catch (error) {
						refPropertiesSetting.setDesc("YAML Parse Error: " + error.message);
					}
				});
			});
	}


}

export default class Bibliosidian extends Plugin {
	settings: BibliosidianSettings;
    dataService: DataService;

	async onload() {
		await this.loadSettings();
		this.dataService = new DataService();


		this.addRibbonIcon("book-up-2", "Create or update a single bibliographic note from BibTeX data", () => {
			this.updateBiblioNoteFromBibTex()
		});
		this.addRibbonIcon("library-square", "Update multiple bibliographical notes from BibTeX data", () => {
			this.updateBiblioNoteLibraryFromBibTex()
		});
		this.addRibbonIcon("book-plus", "Attach a holding to the current note", () => {
			this.addHolding()
		});

		this.addCommand({
			id: 'update-biblionote-library-from-bibtex',
			name: 'Update multiple bibliographical notes from a BibTeX bibliography database file',
			callback: () => this.updateBiblioNoteLibraryFromBibTex(),
		});

		this.addCommand({
			id: 'update-biblionote-from-bibtex',
			name: 'Create or update a single bibliographic note from BibTeX data',
			callback: () => this.updateBiblioNoteFromBibTex(),
		});

		this.addCommand({
			id: 'add-biblionote-holding',
			name: 'Attach a holding to the current note',
			callback: () => this.addHolding(),
		});

        this.addCommand({
            id: 'generate-biblionote-citation-list',
            name: 'Generate citation list',
            editorCallback: (editor: Editor) => {
                let activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    return;
                }
                let citationList = new CitationList(
                    activeFile,
		            this.dataService,
                    this.settings,
                );
                let results = citationList.generate();
                editor.replaceRange(
                    results,
                    editor.getCursor(),
                );
            },
        });

		this.addSettingTab(new BibliosidianSettingTab(this.app, this));
	}


    async addHolding() {
        // const files = app.vault.getFiles(); // Get all files in the vault
        let activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }
        const modal = new ImportHoldingModal(
            app,
            this.settings,
        );
        modal.open();
    }

    updateBiblioNoteLibraryFromBibTex() {
        const modal = new BibTexCaptureModal(
            this.app,
            // Added async here to make the function return a Promise<void>
            async (input: string) => {
                if (input) {
                    let sourceBibTex: string = input;
                    let processedResults = await generateBiblioNoteLibrary(
                        this.app,
                        sourceBibTex,
                        this.settings,
                    );
                    if (processedResults.length > 0) {
                        const resultsModal = new BibTexResultsModal(this.app, processedResults);
                        resultsModal.open();
                    } else {
                        new Notice("No results returned by BibTex parser");
                    }
                }
            }
        );
        modal.open();
    }

	updateBiblioNoteFromBibTex(isOpenNote: boolean = true) {
		let defaultBibTex = ""
		createBiblioNote(
			this.app,
			this.settings,
			defaultBibTex,
			"",
			undefined,
			isOpenNote,
			// this.settings.biblioNoteSourcePropertiesPrefix,
			// this.settings.biblioNoteSubdirectoryRoot,
			// this.settings.isSubdirectorizeBiblioNotesLexically,
			// this.settings.authorsParentFolderPath,
			// this.settings.isSubdirectorizeAuthorsLexically,
			// this.settings.isCreateAuthorPages,
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


class BibTexCaptureModal extends Modal {
    private onSubmit: (input: string) => Promise<void>; // Changed to return Promise
    private textArea: HTMLTextAreaElement;

    constructor(app: App, onSubmit: (input: string) => Promise<void>) { // Updated constructor parameter
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Paste your BibTeX data' });

        this.textArea = contentEl.createEl('textarea', {
            cls: 'bibtex-modal-textarea'
        });
        this.textArea.setAttr('rows', '20');
        this.textArea.setAttr('cols', '50');

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText('OK')
                    .setCta()
                    .onClick(async () => { // Made onClick async
                        await this.onSubmit(this.textArea.value);
                        this.close();
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.close();
                    })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}


class BibTexResultsModal extends Modal {
	private processedResults: ProcessedBibTexResult[];

	constructor(app: App, processedResults: ProcessedBibTexResult[]) {
		super(app);
		this.processedResults = processedResults;
	}

	onOpen() {
		const { contentEl } = this;
		const successfulFileLinks = this.processedResults
			.filter(result => result.successful)
			.map(result => `  - "${result.fileLink}"`)
			.join('\n');

		const successfulCitations = this.processedResults
			.filter(result => result.successful)
			.map(result => `- ${result.citation}`)
			.join('\n');

		const unsuccessfulCiteKeys = this.processedResults
			.filter(result => !result.successful)
			.map(result => `${result.citeKey}\n`)
			.join('\n');

		contentEl.createEl('h2', { text: 'Processed BibTeX Results' });

		this.createReadonlyTextArea(contentEl, 'Citations:', successfulCitations);
		this.createReadonlyTextArea(contentEl, 'File links:', successfulFileLinks);
		this.createReadonlyTextArea(contentEl, 'Unsuccessfully parsed citation keys:', unsuccessfulCiteKeys);

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText('OK')
					.setCta()
					.onClick(() => {
						this.close();
					})
			);
	}

	createReadonlyTextArea(container: HTMLElement, label: string, value: string) {
		container.createEl('h3', { text: label });
		const textArea = container.createEl('textarea', {
			cls: 'bibtex-results-textarea',
		});
        textArea.value = value;
		textArea.setAttr('rows', '10');
		textArea.setAttr('cols', '50');
        textArea.setAttr('readonly', 'true');

		new Setting(container)
			.addButton((btn) =>
				btn
					.setButtonText('Copy')
					.onClick(() => {
						navigator.clipboard.writeText(value).then(() => {
							new Notice('Copied to clipboard');
						});
					})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
