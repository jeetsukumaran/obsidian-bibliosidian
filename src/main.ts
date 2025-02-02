
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
    ensureStringArray,
    createOrOpenNote,
    composeNoteLocation,
    createUniqueNote,
} from "./utility";

import {
	FilePropertyData,
	parseYaml,
	stringifyYaml,
	createFilePropertyDataTable,
	updateFrontMatter,
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
    AssociatedNoteSettings,
	BibliosidianSettings,
    DEFAULT_SETTINGS,
} from "./settings";

import {
	BibliosidianSettingsTab,
} from "./settingsTab";

interface Footnote {
    original: string;
    footnote: string;
    index: number;
}

export default class Bibliosidian extends Plugin {
	settings: BibliosidianSettings;
    dataService: DataService;

	async onload() {
		await this.loadSettings();
		this.dataService = new DataService();


		// this.addRibbonIcon("book-up-2", "Create or update a single bibliographic note from BibTeX data", () => {
		// 	this.updateBiblioNoteFromBibTex()
		// });
		this.addRibbonIcon("scroll-text", "Import or update reference notes from BibTeX data", () => {
			this.updateBiblioNoteLibraryFromBibTex()
		});
		this.addRibbonIcon("file-plus-2", "Import an external file as a bibliographic attachment of the current note", () => {
			this.addHolding()
		});

		this.addCommand({
			id: 'update-biblionote-library-from-bibtex',
			name: 'Update multiple bibliographical notes from a BibTeX bibliography database file',
			callback: () => this.updateBiblioNoteLibraryFromBibTex(),
		});

		this.addCommand({
			id: 'open-reading-note',
			name: 'Open reading note linked to the current note',
			callback: () => this.openAssociatedNote(this.settings.associatedNotes[2]),
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

        this.addSettingTab(new BibliosidianSettingsTab(
            this,
            this.settings,
            async () => await this.saveData(this.settings)
        ));
}

    async openAssociatedNote(
        noteConfig:AssociatedNoteSettings,
        isForceNew: boolean = false,
    ) {
        let activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }

        let refFileTitle = "hello";

        const noteLocation = composeNoteLocation(
            activeFile.path,
            noteConfig.parentFolderPath,
            noteConfig.namePrefix,
            noteConfig.namePostfix,
            noteConfig.isSubdirectorizeLexically,
        );

        let newNotePath = "";
        if (isForceNew) {
            newNotePath = await createUniqueNote(
                this.app,
                noteLocation.newFileBasename,
                noteLocation.newFileParentDir,
                "",
                undefined,
            )
        } else {
            newNotePath = await createOrOpenNote(
                this.app,
                noteLocation.newFilePath,
            )
        }
        updateFrontMatter(
            this.app,
            newNotePath,
            {
                "tags": noteConfig.tagMetadata.map( (tag) => tag.replace(/^#/,"") ),
                [noteConfig.returnLinkPropertyName]: [ `[[${activeFile.path}|${refFileTitle}]]`, ],
            } ,
        );
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

    async updateBiblioNoteLibraryFromBibTex() {
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
                        await resultsModal.open();
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
		)
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        this.settings.biblioNoteTagMetadata = ensureStringArray(this.settings.biblioNoteTagMetadata);
        this.settings.authorNoteTagMetadata = ensureStringArray(this.settings.authorNoteTagMetadata);
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
            cls: 'bibliosidian-input-textarea'
        });
        // textArea.classList.add('bibtex-results-textarea');
        this.textArea.classList.add('bibliosidian-full-textarea');

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

        let filteredResults = this.processedResults
                .filter(result => result.successful);
        let valueGroups = [
            filteredResults
                .map(result => `- [@${result.citeKey}]: *[[${result.linkFilePath}|${result.title}]]*.`)
                .join('\n'),
            filteredResults
                .map(result => `- "[[${result.linkFilePath}]]*"`)
                .join('\n'),
            filteredResults
                .map(result => `- [@${result.citeKey}]`)
                .join('\n'),
            filteredResults
                .map(result => `- "[[${result.linkFilePath}|${result.title}]]"`)
                .join('\n'),
        ];
        let currentGroupIndex = 0;

        contentEl.createEl('h2', { text: `References imported: ${filteredResults.length}` });
        new Setting(contentEl)
            .addButton((btn) =>
                btn
                .setButtonText('Prev format')
                .onClick(() => {
                    currentGroupIndex = currentGroupIndex == 0 ? valueGroups.length - 1 : currentGroupIndex -1;
                    referencesTextArea.value = valueGroups[currentGroupIndex];
                })
            )
            .addButton((btn) =>
                btn
                .setButtonText('Next format')
                .onClick(() => {
                    currentGroupIndex = (currentGroupIndex + 1) % valueGroups.length;
                    referencesTextArea.value = valueGroups[currentGroupIndex];
                })
            )

        let referencesTextArea = this.createReadonlyTextArea(
            contentEl,
            valueGroups[currentGroupIndex]
        );

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                .setButtonText('Copy')
                .onClick(async () => {
                    // Copy to clipboard
                    await navigator.clipboard.writeText(referencesTextArea.value);
                    new Notice('Copied to clipboard');
                })
            )
            .addButton((btn) =>
                btn
                .setButtonText('Copy and close')
                .onClick(async () => {
                    // Copy to clipboard
                    await navigator.clipboard.writeText(referencesTextArea.value);
                    new Notice('Copied to clipboard');
                    // Close the modal
                    this.close();
                })
            )
            .addButton((btn) =>
                btn
                .setButtonText('Close and open first imported reference')
                .onClick(async () => {
                    let firstResult = filteredResults[0];
                    await createOrOpenNote(this.app, firstResult.linkFilePath);
                    this.close();
                })
            )
            .addButton((btn) =>
                btn
                .setButtonText('Close')
                .setCta()
                .onClick(() => {
                    this.close();
                })
            );
    }

    createReadonlyTextArea(container: HTMLElement, value: string): HTMLTextAreaElement {
        const textArea = document.createElement('textarea');
        textArea.classList.add('bibliosidian-full-textarea');
        textArea.value = value;
        textArea.readOnly = true;
        container.appendChild(textArea);
        return textArea;
    }

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

