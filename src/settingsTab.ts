
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
	AssociatedNoteSettings,
	BibliosidianSettings,
    DEFAULT_SETTINGS,
} from "./settings";

export class BibliosidianSettingsTab extends PluginSettingTab {
	plugin: Plugin;
	settings: BibliosidianSettings;
	// saveSettingsCallback: (settings: BibliosidianSettings) => Promise<void>;
	saveSettingsCallback: () => Promise<void>;

	constructor(
        plugin: Plugin,
        settings: BibliosidianSettings,
        // saveSettingsCallback: (settings: BibliosidianSettings) => Promise<void>,
        saveSettingsCallback: () => Promise<void>,
	) {
		super(plugin.app, plugin);
		this.plugin = plugin;
		this.settings = settings;
		this.saveSettingsCallback = saveSettingsCallback;
	}

	async saveSettings() {
	    await this.saveSettingsCallback()
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();


		containerEl.createEl("h2", { text: "Bibliographical notes" })

        // containerEl.createEl("p", {
        //     text: "A bibliographical note is the main reference linking to the source. It contains standardized metadata such as authors, title, publication year, and source details."
        // });

		new Setting(containerEl)
			.setName("Bibliographical notes folder")
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
			.setName("Source BibTeX property name")
			.setDesc(`Front matter metadata property in bibliographic note to store source BibTeX data. `)
			.addText(text => text
				.setPlaceholder("(YAML frontmatter property name, e.g. 'reference-bibtex')")
				.setValue(this.settings.biblioNoteSourceBibTex)
				.onChange(async (value) => {
					this.settings.biblioNoteSourceBibTex = value;
					await this.saveSettings();
		}));

		new Setting(containerEl)
			.setName("Front matter metadata property name prefix")
			.setDesc(
                "This will be prefixed to the normalized bibliographic (YAML frontmatter properties)"
                + " data fields. For example, if set to 'reference-',"
                + " the frontmatter YAML field will be 'reference-authors' instead of just 'authors'. "
			)
			.addText(text => text
				.setPlaceholder("(e.g., 'reference-')")
				.setValue(this.settings.biblioNoteSourcePropertiesPrefix)
				.onChange(async (value) => {
					this.settings.biblioNoteSourcePropertiesPrefix = value;
		}));


        new Setting(containerEl)
            .setName("Tag metadata")
            .setDesc("Enter tags to be added, one per line. No leading hash (#).")
            .addTextArea(text => {
                text.setPlaceholder("source/reference")
                    .setValue(this.settings.biblioNoteTagMetadata?.tags?.join("\n") || "")
                    .onChange(async (value) => {
                        this.settings.biblioNoteTagMetadata = normalizeTagInput(value);
                        await this.saveSettings();
                    });
                // text.inputEl.style.height = "8rem";
            });

		this.manageAdditionalPropertiesSettings(
			containerEl,
			"biblioNoteAdditionalMetadata",
		)

		containerEl.createEl("h2", { text: "Author notes" })


		new Setting(containerEl)
			.setName("Create author notes automatically")
			.setDesc("Enable or disable creation or updating of linked author notes when creating or updating bibliographic notes.")
			.addToggle(toggle => toggle
					.setValue(this.settings.isCreateAuthorNotes)
					.onChange(async (value) => {
						this.settings.isCreateAuthorNotes = value;
						await this.saveSettings();
		}));

		new Setting(containerEl)
			.setName("Author notes folder")
			.setDesc("Path to folder of author notes.")
			.addText(text => text
				.setPlaceholder("(E.g. 'sources/authors')")
				.setValue(this.settings.authorNoteParentFolderPath)
				.onChange(async (value) => {
					this.settings.authorNoteParentFolderPath = value;
					await this.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Organize author notes into subdirectories based on names")
			.setDesc("Enable or disable lexical organization of author notes into subdirectories.")
			.addToggle(toggle => toggle
				.setValue(this.settings.isSubdirectorizeAuthorNotesLexically)
				.onChange(async (value) => {
					this.settings.isSubdirectorizeAuthorNotesLexically = value;
					await this.saveSettings();
        }));
		new Setting(containerEl)
			.setName("Bibliographic note backlink property name:")
			.setDesc("Front matter metadata property on author note linking to associated bibliographic note.")
			.addText(text => text
				.setPlaceholder("(E.g. 'author-references')")
				.setValue(this.settings.authorBiblioNoteOutlinkPropertyName)
				.onChange(async (value) => {
					this.settings.authorBiblioNoteOutlinkPropertyName = value
					await this.saveSettings();
		}));

        new Setting(containerEl)
            .setName("Tag metadata")
            .setDesc("Enter tags to be added, one per line. No leading hash (#).")
            .addTextArea(text => {
                text.setPlaceholder("source/author")
                    .setValue(this.settings.authorNoteTagMetadata?.tags?.join("\n") || "")
                    .onChange(async (value) => {
                        this.settings.authorNoteTagMetadata = normalizeTagInput(value);
                        await this.saveSettings();
                    });
                // text.inputEl.style.height = "8rem";
            });


		this.manageAdditionalPropertiesSettings(
			containerEl,
			"authorNoteAdditionalMetadata",
		)

        containerEl.createEl("h2", { text: `Associated notes` })
		this.settings.associatedNotes.forEach( (noteConfig: AssociatedNoteSettings) => {
		    const className = noteConfig.className || "";
		    containerEl.createEl("h3", { text: `${className} notes` })
            new Setting(containerEl)
            	.setName("Create automatically")
            	.setDesc("Enable or disable automatic creation when importing or updating bibliographic notes.")
            	.addToggle(toggle => toggle
            			.setValue(noteConfig.isAutoCreate)
            			.onChange(async (value) => {
            				noteConfig.isAutoCreate = value;
            				await this.saveSettings();
            }));
            new Setting(containerEl)
            	.setName("Parent folder")
            	.setDesc("Path to parent folder of associated notes.")
            	.addText(text => text
            		.setPlaceholder(`(E.g. 'sources/${className.toLowerCase()}')`)
            		.setValue(noteConfig.parentFolderPath)
            		.onChange(async (value) => {
            			noteConfig.parentFolderPath = value;
            			await this.saveSettings();
            }));
            new Setting(containerEl)
            	.setName("Organize into subdirectories based on source names")
            	.setDesc("Enable or disable lexical organization of notes into subdirectories.")
            	.addToggle(toggle => toggle
            		.setValue(noteConfig.isSubdirectorizeLexically)
            		.onChange(async (value) => {
            			noteConfig.isSubdirectorizeLexically = value;
            			await this.saveSettings();
            }));
            new Setting(containerEl)
            	.setName("Bibliographic reference note property name")
            	.setDesc("Front matter metadata property linking to main bibliographic note.")
            	.addText(text => text
            		.setPlaceholder(`(E.g. 'sources/${className.toLowerCase()}')`)
            		.setValue(noteConfig.returnLinkPropertyName)
            		.onChange(async (value) => {
            			noteConfig.returnLinkPropertyName = value
            			await this.saveSettings();
            }));

            new Setting(containerEl)
                .setName("Tag metadata")
                .setDesc("Enter tags to be added, one per line. No leading hash (#).")
                .addTextArea(text => {text
                    .setPlaceholder("source/extract")
                    .setValue(noteConfig.tagMetadata?.join("\n") || "")
                    .onChange(async (value) => {
                        noteConfig.tagMetadata = normalizeTagInput(value);
                        await this.saveSettings();
                     });
            // text.inputEl.style.height = "8rem";
            });


            // this.manageAdditionalPropertiesSettings(
            // 	containerEl,
            // 	"extractNoteAdditionalMetadata",
            // )

            // new Setting(containerEl)
            // 	.setName("Extract notes folder")
            // 	.setDesc("Path to folder of extract notes.")
            // 	.addText(text => text
            // 		.setPlaceholder("(E.g. 'sources/extracts')")
            // 		.setValue(this.settings.extractNoteParentFolderPath)
            // 		.onChange(async (value) => {
            // 			this.settings.extractNoteParentFolderPath = value;
            // 			await this.saveSettings();
            // }));
            // new Setting(containerEl)
            // 	.setName("Organize extract notes into subdirectories based on source names")
            // 	.setDesc("Enable or disable lexical organization of extract notes into subdirectories.")
            // 	.addToggle(toggle => toggle
            // 		.setValue(this.settings.isSubdirectorizeExtractNotesLexically)
            // 		.onChange(async (value) => {
            // 			this.settings.isSubdirectorizeExtractNotesLexically = value;
            // 			await this.saveSettings();
            // }));
            // new Setting(containerEl)
            // 	.setName("Bibliographic note backlink property name:")
            // 	.setDesc("Front matter metadata property on extract note linking to associated bibliographic note.")
            // 	.addText(text => text
            // 		.setPlaceholder("(E.g. 'extract-references')")
            // 		.setValue(this.settings.extractNoteBiblioNoteOutlinkPropertyName)
            // 		.onChange(async (value) => {
            // 			this.settings.extractNoteBiblioNoteOutlinkPropertyName = value
            // 			await this.saveSettings();
            // }));

            // new Setting(containerEl)
            // .setName("Tag metadata")
            // .setDesc("Enter tags to be added, one per line. No leading hash (#).")
            // .addTextArea(text => {
            // text.setPlaceholder("source/extract")
            // .setValue(this.settings.extractNoteTagMetadata?.tags?.join("\n") || "")
            // .onChange(async (value) => {
            // this.settings.extractNoteTagMetadata = normalizeTagInput(value);
            // await this.saveSettings();
            // });
            // // text.inputEl.style.height = "8rem";
            // });


            // this.manageAdditionalPropertiesSettings(
            // 	containerEl,
            // 	"extractNoteAdditionalMetadata",
            // )
		});

		// containerEl.createEl("h2", { text: "Extract notes" })

		// new Setting(containerEl)
		// 	.setName("Create extract notes automatically")
		// 	.setDesc("Enable or disable automatic creation linked extract notes when creating or updating bibliographic notes.")
		// 	.addToggle(toggle => toggle
		// 			.setValue(this.settings.isCreateExtractNotes)
		// 			.onChange(async (value) => {
		// 				this.settings.isCreateExtractNotes = value;
		// 				await this.saveSettings();
		// }));

		// new Setting(containerEl)
		// 	.setName("Extract notes folder")
		// 	.setDesc("Path to folder of extract notes.")
		// 	.addText(text => text
		// 		.setPlaceholder("(E.g. 'sources/extracts')")
		// 		.setValue(this.settings.extractNoteParentFolderPath)
		// 		.onChange(async (value) => {
		// 			this.settings.extractNoteParentFolderPath = value;
		// 			await this.saveSettings();
		// }));
		// new Setting(containerEl)
		// 	.setName("Organize extract notes into subdirectories based on source names")
		// 	.setDesc("Enable or disable lexical organization of extract notes into subdirectories.")
		// 	.addToggle(toggle => toggle
		// 		.setValue(this.settings.isSubdirectorizeExtractNotesLexically)
		// 		.onChange(async (value) => {
		// 			this.settings.isSubdirectorizeExtractNotesLexically = value;
		// 			await this.saveSettings();
        // }));
		// new Setting(containerEl)
		// 	.setName("Bibliographic note backlink property name:")
		// 	.setDesc("Front matter metadata property on extract note linking to associated bibliographic note.")
		// 	.addText(text => text
		// 		.setPlaceholder("(E.g. 'extract-references')")
		// 		.setValue(this.settings.extractNoteBiblioNoteOutlinkPropertyName)
		// 		.onChange(async (value) => {
		// 			this.settings.extractNoteBiblioNoteOutlinkPropertyName = value
		// 			await this.saveSettings();
		// }));

        // new Setting(containerEl)
            // .setName("Tag metadata")
            // .setDesc("Enter tags to be added, one per line. No leading hash (#).")
            // .addTextArea(text => {
                // text.setPlaceholder("source/extract")
                    // .setValue(this.settings.extractNoteTagMetadata?.tags?.join("\n") || "")
                    // .onChange(async (value) => {
                        // this.settings.extractNoteTagMetadata = normalizeTagInput(value);
                        // await this.saveSettings();
                    // });
                // // text.inputEl.style.height = "8rem";
            // });


		// this.manageAdditionalPropertiesSettings(
		// 	containerEl,
		// 	"extractNoteAdditionalMetadata",
		// )




		// containerEl.createEl("h2", { text: "Reading notes" })

		// new Setting(containerEl)
		// 	.setName("Create reading notes automatically")
		// 	.setDesc("Enable or disable creation or updating of linked reading notes when creating or updating bibliographic notes.")
		// 	.addToggle(toggle => toggle
		// 			.setValue(this.settings.isCreateReadingNotes)
		// 			.onChange(async (value) => {
		// 				this.settings.isCreateReadingNotes = value;
		// 				await this.saveSettings();
		// }));

		// new Setting(containerEl)
		// 	.setName("Reading notes folder")
		// 	.setDesc("Path to folder of reading notes.")
		// 	.addText(text => text
		// 		.setPlaceholder("(E.g. 'sources/readings')")
		// 		.setValue(this.settings.readingNoteParentFolderPath)
		// 		.onChange(async (value) => {
		// 			this.settings.readingNoteParentFolderPath = value;
		// 			await this.saveSettings();
		// }));
		// new Setting(containerEl)
		// 	.setName("Organize reading notes into subdirectories based on source names")
		// 	.setDesc("Enable or disable lexical organization of reading notes into subdirectories.")
		// 	.addToggle(toggle => toggle
		// 		.setValue(this.settings.isSubdirectorizeReadingNotesLexically)
		// 		.onChange(async (value) => {
		// 			this.settings.isSubdirectorizeReadingNotesLexically = value;
		// 			await this.saveSettings();
        // }));
		// new Setting(containerEl)
		// 	.setName("Bibliographic note backlink property name:")
		// 	.setDesc("Front matter metadata property on reading note linking to associated bibliographic note.")
		// 	.addText(text => text
		// 		.setPlaceholder("(E.g. 'reading-references')")
		// 		.setValue(this.settings.readingNoteBiblioNoteOutlinkPropertyName)
		// 		.onChange(async (value) => {
		// 			this.settings.readingNoteBiblioNoteOutlinkPropertyName = value
		// 			await this.saveSettings();
		// }));

        // new Setting(containerEl)
            // .setName("Tag metadata")
            // .setDesc("Enter tags to be added, one per line. No leading hash (#).")
            // .addTextArea(text => {
                // text.setPlaceholder("source/reading")
                    // .setValue(this.settings.readingNoteTagMetadata?.tags?.join("\n") || "")
                    // .onChange(async (value) => {
                        // this.settings.readingNoteTagMetadata = normalizeTagInput(value);
                        // await this.saveSettings();
                    // });
                // // text.inputEl.style.height = "8rem";
            // });


		// this.manageAdditionalPropertiesSettings(
		// 	containerEl,
		// 	"readingNoteAdditionalMetadata",
		// )


		containerEl.createEl("h2", { text: "Holdings" })

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

		// containerEl.createEl("h2", { text: "Readings" })

		// new Setting(containerEl)
		// 	.setName("Reading folder")
		// 	.setDesc("Path to folder of author notes.")
		// 	.addText(text => text
		// 		.setPlaceholder("(E.g. 'journals/reading')")
		// 		.setValue(this.settings.readingNoteParentFolderPath)
		// 		.onChange(async (value) => {
		// 			this.settings.readingNoteParentFolderPath = value;
		// 			await this.saveSettings();
		// }));
		// new Setting(containerEl)
		// 	.setName("Organize authors into subdirectories")
		// 	.setDesc("Enable or disable lexical organization of authors into subdirectories.")
		// 	.addToggle(toggle => toggle
		// 		.setValue(this.settings.isSubdirectorizeAuthorNotesLexically)
		// 		.onChange(async (value) => {
		// 			this.settings.isSubdirectorizeAuthorNotesLexically = value;
		// 			await this.saveSettings();
        // }));
		// new Setting(containerEl)
		// 	.setName("Bibliographic note link property name:")
		// 	.setDesc("Name of property on author note linking to associated bibliographic notes.")
		// 	.addText(text => text
		// 		.setPlaceholder("(E.g. 'references', 'works', 'bibliographies')")
		// 		.setValue(this.settings.authorBiblioNoteOutlinkPropertyName)
		// 		.onChange(async (value) => {
		// 			this.settings.authorBiblioNoteOutlinkPropertyName = value
		// 			await this.saveSettings();
		// }));

        // new Setting(containerEl)
            // .setName("Author note tag metadata")
            // .setDesc("Enter tags for author notes, one per line. No leading hash (#).")
            // .addTextArea(text => {
                // text.setPlaceholder("author\nsource/author\nimportant-author")
                    // .setValue(this.settings.authorNoteTagMetadata?.tags?.join("\n") || "")
                    // .onChange(async (value) => {
                        // this.settings.authorNoteTagMetadata = normalizeTagInput(value);
                        // await this.saveSettings();
                    // });
                // // text.inputEl.style.height = "8rem";
            // });


		// this.manageAdditionalPropertiesSettings(
		// 	containerEl,
		// 	"authorNoteAdditionalMetadata",
		// )

	}


	manageAdditionalPropertiesSettings(
		containerEl: HTMLElement,
		settingsPropertyName: "biblioNoteAdditionalMetadata" | "authorNoteAdditionalMetadata",
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
				// text.inputEl.style.height = "8rem"
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

