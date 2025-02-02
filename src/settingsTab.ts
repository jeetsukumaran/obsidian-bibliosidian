
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
    createOrOpenNote,
} from "./utility";

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
import { normalizeTagInput } from './utility'; // Ensure the path is correct


import {
	BibliosidianSettings,
    DEFAULT_SETTINGS,
} from "./settings";

export class BibliosidianSettingsTab extends PluginSettingTab {
	plugin: Plugin;
	settings: BibliosidianSettings;
	saveSettingsCallback: (settings: BibliosidianSettings) => Promise<void>;

	constructor(
        plugin: Plugin,
        settings: BibliosidianSettings,
        saveSettingsCallback: (settings: BibliosidianSettings) => Promise<void>,
	) {
		super(plugin.app, plugin);
		this.plugin = plugin;
		this.settings = settings;
		this.saveSettingsCallback = saveSettingsCallback;
	}

	async saveSettings() {
	    await this.saveSettingsCallback(this.settings)
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl("h3", { text: "Namespaces" })

		new Setting(containerEl)
			.setName("Source bibliographic data property name prefix")
			.setDesc(
                "This will be prefixed to the normalized bibliographic (YAML frontmatter properties)"
                + " data fields. For example, if set to 'source-',"
                + " the frontmatter YAML field will be 'source-authors' instead of just 'authors'. "
			)
			.addText(text => text
				.setPlaceholder("(e.g., 'source-')")
				.setValue(this.settings.biblioNoteSourcePropertiesPrefix)
				.onChange(async (value) => {
					this.settings.biblioNoteSourcePropertiesPrefix = value;
		}));
		new Setting(containerEl)
			.setName("Source BibTeX property name")
			.setDesc(` Property on bibliographic note to store source BibTeX data. `)
			.addText(text => text
				.setPlaceholder("(YAML frontmatter property name, e.g. 'source-bibtex')")
				.setValue(this.settings.biblioNoteSourceBibTex)
				.onChange(async (value) => {
					this.settings.biblioNoteSourceBibTex = value;
					await this.saveSettings();
		}));


		new Setting(containerEl)
			.setName("Bibliographic notes folder")
			.setDesc("Path to folder of bibliographic notes.")
			.addText(text => text
				.setPlaceholder("(E.g. 'sources/references')")
				.setValue(this.settings.biblioNoteParentFolder)
				.onChange(async (value) => {
					this.settings.biblioNoteParentFolder = value;
					await this.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Organize bibliographic notes into subdirectories based on citation key")
			.setDesc("Enable or disable lexical organization of bibliographic notes into subdirectories.")
			.addToggle(toggle => toggle
				.setValue(this.settings.isSubdirectorizeBiblioNotesLexically)
				.onChange(async (value) => {
					this.settings.isSubdirectorizeBiblioNotesLexically = value;
					await this.saveSettings();
        }));

		new Setting(containerEl)
			.setName("Create author notes automatically")
			.setDesc("Enable or disable creation or updating of linked author notes when creating or updating bibliographic notes.")
			.addToggle(toggle => toggle
					.setValue(this.settings.isCreateAuthorPages)
					.onChange(async (value) => {
						this.settings.isCreateAuthorPages = value;
						await this.saveSettings();
		}));


        new Setting(containerEl)
            .setName("Bibliographic Note Tag Metadata")
            .setDesc("Enter tags for bibliographic notes, one per line. No leading hash (#).")
            .addTextArea(text => {
                text.setPlaceholder("literature\nreference\nliterature/study")
                    .setValue(this.settings.biblioNoteTagMetadata?.tags?.join("\n") || "")
                    .onChange(async (value) => {
                        this.settings.biblioNoteTagMetadata = normalizeTagInput(value);
                        await this.saveSettings();
                    });
                text.inputEl.style.height = "8rem";
            });

		this.manageAdditionalPropertiesSettings(
			containerEl,
			"biblioNoteAdditionalMetadata",
		)

		containerEl.createEl("h3", { text: "Authors" })

		new Setting(containerEl)
			.setName("Authors folder")
			.setDesc("Path to folder of author notes.")
			.addText(text => text
				.setPlaceholder("(E.g. 'sources/authors')")
				.setValue(this.settings.authorNoteParentFolderPath)
				.onChange(async (value) => {
					this.settings.authorNoteParentFolderPath = value;
					await this.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Organize authors into subdirectories")
			.setDesc("Enable or disable lexical organization of authors into subdirectories.")
			.addToggle(toggle => toggle
				.setValue(this.settings.isSubdirectorizeAuthorNotesLexically)
				.onChange(async (value) => {
					this.settings.isSubdirectorizeAuthorNotesLexically = value;
					await this.saveSettings();
        }));
		new Setting(containerEl)
			.setName("Bibliographic note link property name:")
			.setDesc("Name of property on author note linking to associated bibliographic notes.")
			.addText(text => text
				.setPlaceholder("(E.g. 'references', 'works', 'bibliographies')")
				.setValue(this.settings.authorBiblioNoteOutlinkPropertyName)
				.onChange(async (value) => {
					this.settings.authorBiblioNoteOutlinkPropertyName = value
					await this.saveSettings();
		}));

        new Setting(containerEl)
            .setName("Author note tag metadata")
            .setDesc("Enter tags for author notes, one per line. No leading hash (#).")
            .addTextArea(text => {
                text.setPlaceholder("author\nliterature/author\nimportant-author")
                    .setValue(this.settings.authorNoteTagMetadata?.tags?.join("\n") || "")
                    .onChange(async (value) => {
                        this.settings.authorNoteTagMetadata = normalizeTagInput(value);
                        await this.saveSettings();
                    });
                text.inputEl.style.height = "8rem";
            });


		this.manageAdditionalPropertiesSettings(
			containerEl,
			"authorNoteAdditionalMetadata",
		)

		containerEl.createEl("h3", { text: "Holdings" })

		new Setting(containerEl)
			.setName("Holdings folder")
			.setDesc("Path to parent or root folder of holdings (attachments). Leave blank to store alongside bibliographic file.")
			.addText(text => text
				.setPlaceholder("(E.g. 'sources/references')")
				.setValue(this.settings.holdingsParentFolder)
				.onChange(async (value) => {
					this.settings.holdingsParentFolder = value;
					await this.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Holdings outlink property name:")
			.setDesc("Name of property on bibliographic note to update with link to imported holdings.")
			.addText(text => text
				.setPlaceholder("(E.g. 'attachments' or 'pdfs')")
				.setValue(this.settings.holdingsPropertyName)
				.onChange(async (value) => {
					this.settings.holdingsPropertyName = value;
					await this.saveSettings();
		}));

		containerEl.createEl("h3", { text: "Readings" })

		new Setting(containerEl)
			.setName("Reading folder")
			.setDesc("Path to folder of author notes.")
			.addText(text => text
				.setPlaceholder("(E.g. 'journals/reading')")
				.setValue(this.settings.readingNoteParentFolderPath)
				.onChange(async (value) => {
					this.settings.readingNoteParentFolderPath = value;
					await this.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Organize authors into subdirectories")
			.setDesc("Enable or disable lexical organization of authors into subdirectories.")
			.addToggle(toggle => toggle
				.setValue(this.settings.isSubdirectorizeAuthorNotesLexically)
				.onChange(async (value) => {
					this.settings.isSubdirectorizeAuthorNotesLexically = value;
					await this.saveSettings();
        }));
		new Setting(containerEl)
			.setName("Bibliographic note link property name:")
			.setDesc("Name of property on author note linking to associated bibliographic notes.")
			.addText(text => text
				.setPlaceholder("(E.g. 'references', 'works', 'bibliographies')")
				.setValue(this.settings.authorBiblioNoteOutlinkPropertyName)
				.onChange(async (value) => {
					this.settings.authorBiblioNoteOutlinkPropertyName = value
					await this.saveSettings();
		}));

        new Setting(containerEl)
            .setName("Author note tag metadata")
            .setDesc("Enter tags for author notes, one per line. No leading hash (#).")
            .addTextArea(text => {
                text.setPlaceholder("author\nliterature/author\nimportant-author")
                    .setValue(this.settings.authorNoteTagMetadata?.tags?.join("\n") || "")
                    .onChange(async (value) => {
                        this.settings.authorNoteTagMetadata = normalizeTagInput(value);
                        await this.saveSettings();
                    });
                text.inputEl.style.height = "8rem";
            });


		this.manageAdditionalPropertiesSettings(
			containerEl,
			"authorNoteAdditionalMetadata",
		)

	}


	manageAdditionalPropertiesSettings(
		containerEl: HTMLElement,
		settingsPropertyName: "biblioNoteAdditionalMetadata" | "authorNoteAdditionalMetadata" | "readingNoteAdditionalMetadata",
		settingsPropertyDisplayName: string = "Additional front matter properties (YAML)",
		settingsPropertyParameterInitialDescription: string = "Other front matter metadata properties to be updated specified in YAML.",
		settingsPropertyParameterPlaceholder: string = "(E.g., 'reference-case: Project 1', 'reading-priority: medium')",
	) {
			let currentAdditionalPropertiesString: string = "";
			if (this.settings[settingsPropertyName]) {
				let cachedValue: FilePropertyData = this.settings[settingsPropertyName] as FilePropertyData
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
						// this.settings.biblioNoteAdditionalMetadata = stringifyYaml(refProperties);
						// this.settings[settingsPropertyName] = refProperties;
						this.settings[settingsPropertyName] = refProperties
						await this.saveSettings();
					} catch (error) {
						refPropertiesSetting.setDesc("YAML Parse Error: " + error.message);
					}
				});
			});
	}


}

