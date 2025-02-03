
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
    fileDataService,

} from "./fileDataService";
import { splitStringArray } from './utility'; // Ensure the path is correct


import {
	NoteConfiguration,
	BibliosidianConfiguration,
	BibliosidianSettings,
    DEFAULT_SETTINGS,
} from "./settings";

export class BibliosidianSettingsTab extends PluginSettingTab {
	plugin: Plugin;
	configuration: BibliosidianConfiguration;
	// saveSettingsCallback: (configuration: BibliosidianSettings) => Promise<void>;
	saveSettingsCallback: () => Promise<void>;

	constructor(
        plugin: Plugin,
        configuration: BibliosidianConfiguration,
        saveSettingsCallback: () => Promise<void>,
	) {
		super(plugin.app, plugin);
		this.plugin = plugin;
		this.configuration = configuration;
		this.saveSettingsCallback = saveSettingsCallback;
	}

	async saveSettings() {
	    await this.saveSettingsCallback()
	}

	setupNoteConfigurationSettings(
        containerEl: HTMLElement,
        noteConfig: NoteConfiguration,
        excludeElements: { [key:string]: boolean },
	) {
        const className = noteConfig.className || "";

        if (!excludeElements["header"]) {
            containerEl.createEl("h3", { text: `${className} notes` })
        }

        if (!excludeElements["description"]) {
            if (noteConfig.description) {
                containerEl.createEl("p", {
                    text: noteConfig.description,
                });
            }
        }
        if (!excludeElements["isAutoCreate"]) {
            new Setting(containerEl)
                .setName("Create automatically")
                .setDesc("Enable or disable automatic creation when importing or updating bibliographic notes.")
                .addToggle(toggle => toggle
                        .setValue(noteConfig.isAutoCreate)
                        .onChange(async (value) => {
                            noteConfig.isAutoCreate = value;
                            await this.saveSettings();
            }));
        }
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
        if (!excludeElements["namePrefix"]) {
            new Setting(containerEl)
                .setName("Name composition: prefix")
                .setDesc("String to prefix in front of base file name to disambiguate it from reference.")
                .addText(text => text
                    .setPlaceholder(`(E.g. '${className.toLowerCase()}_')`)
                    .setValue(noteConfig.namePrefix)
                    .onChange(async (value) => {
                        noteConfig.namePrefix = value;
                        await this.saveSettings();
            }));
        }
        if (!excludeElements["namePostfix"]) {
            new Setting(containerEl)
                .setName("Name composition: postfix")
                .setDesc("String to append to back of base file name to disambiguate it from reference.")
                .addText(text => text
                    .setPlaceholder(`(E.g. '_${className.toLowerCase()}')`)
                    .setValue(noteConfig.namePostfix)
                    .onChange(async (value) => {
                        noteConfig.namePostfix = value;
                        await this.saveSettings();
            }));
        }
        new Setting(containerEl)
            .setName("Organize into subdirectories based on source names")
            .setDesc("Enable or disable lexical organization of notes into subdirectories.")
            .addToggle(toggle => toggle
                .setValue(noteConfig.isSubdirectorizeLexically)
                .onChange(async (value) => {
                    noteConfig.isSubdirectorizeLexically = value;
                    await this.saveSettings();
        }));
        if (!excludeElements["biblioNoteLinkPropertyName"]) {
            new Setting(containerEl)
                .setName("Bibliographic reference note link property name")
                .setDesc("Front matter metadata property linking to main bibliographic note.")
                .addText(text => text
                    .setPlaceholder(`(E.g. 'sources/${className.toLowerCase()}')`)
                    .setValue(noteConfig.biblioNoteLinkPropertyName)
                    .onChange(async (value) => {
                        noteConfig.biblioNoteLinkPropertyName = value
                        await this.saveSettings();
            }));
        }
        if (!excludeElements["childLinkPropertyName"]) {
            new Setting(containerEl)
                .setName("Related notes link property name")
                .setDesc("Front matter metadata property linking to notes bibliographic note.")
                .addText(text => text
                    .setPlaceholder(`(E.g. 'sources/${className.toLowerCase()}')`)
                    .setValue(noteConfig.childLinkPropertyName)
                    .onChange(async (value) => {
                        noteConfig.childLinkPropertyName = value
                        await this.saveSettings();
            }));
        }

        new Setting(containerEl)
            .setName("Tag metadata")
            .setDesc("Enter tags to be added, separated by newlines, spaces, commas, or semicolons.")
            .addTextArea(text => {text
                .setPlaceholder(`(E.g. '#source/${className.toLowerCase()}')`)
                .setValue(noteConfig.tagMetadata?.join("\n") || "")
                .onChange(async (value) => {
                    noteConfig.tagMetadata = splitStringArray(value);
                    await this.saveSettings();
                    });
        });
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

        containerEl.createEl("h2", { text: `Core notes` })
		this.configuration.associatedNotes.forEach( (noteConfig: NoteConfiguration) => {
		});


		// containerEl.createEl("h2", { text: "Bibliographical notes" })

        // containerEl.createEl("p", {
        //     text: "Primary reference notes for the sources, with fundamental bibliographical data.",
        // });

		// new Setting(containerEl)
			// .setName("Bibliographical notes folder")
			// .setDesc("Path to folder of bibliographic notes.")
			// .addText(text => text
				// .setPlaceholder("(E.g. 'sources/references')")
				// .setValue(this.configuration.biblioNoteParentFolder)
				// .onChange(async (value) => {
					// this.configuration.biblioNoteParentFolder = value;
					// await this.saveSettings();
		// }));

		// new Setting(containerEl)
			// .setName("Organize bibliographic notes into subdirectories based on citation key")
			// .setDesc("Enable or disable lexical organization of bibliographic notes into subdirectories.")
			// .addToggle(toggle => toggle
				// .setValue(this.configuration.isSubdirectorizeBiblioNotesLexically)
				// .onChange(async (value) => {
					// this.configuration.isSubdirectorizeBiblioNotesLexically = value;
					// await this.saveSettings();
        // }));

		// new Setting(containerEl)
			// .setName("Source BibTeX property name")
			// .setDesc(`Front matter metadata property in bibliographic note to store source BibTeX data. `)
			// .addText(text => text
				// .setPlaceholder("(YAML frontmatter property name, e.g. 'reference-bibtex')")
				// .setValue(this.configuration.biblioNoteSourceBibTex)
				// .onChange(async (value) => {
					// this.configuration.biblioNoteSourceBibTex = value;
					// await this.saveSettings();
		// }));

		// new Setting(containerEl)
			// .setName("Front matter metadata property name prefix")
			// .setDesc(
        //         "This will be prefixed to the normalized bibliographic (YAML frontmatter properties)"
        //         + " data fields. For example, if set to 'reference-',"
        //         + " the frontmatter YAML field will be 'reference-authors' instead of just 'authors'. "
			// )
			// .addText(text => text
				// .setPlaceholder("(e.g., 'reference-')")
				// .setValue(this.configuration.biblioNoteSourcePropertiesPrefix)
				// .onChange(async (value) => {
					// this.configuration.biblioNoteSourcePropertiesPrefix = value;
		// }));


        // new Setting(containerEl)
        //     .setName("Tag metadata")
        //     .setDesc("Enter tags to be added, separated by newlines, spaces, commas, or semicolons.")
        //     .addTextArea(text => {
        //         text.setPlaceholder("#source/reference")
        //             .setValue(this.configuration.biblioNoteTagMetadata?.join("\n") || "")
        //             .onChange(async (value) => {
        //                 this.configuration.biblioNoteTagMetadata = splitStringArray(value);
        //                 await this.saveSettings();
        //             });
        //         // text.inputEl.style.height = "8rem";
        //     });

		// this.manageAdditionalPropertiesSettings(
			// containerEl,
			// "biblioNoteAdditionalMetadata",
		// )

		// containerEl.createEl("h2", { text: "Author notes" })

        // containerEl.createEl("p", {
        //     text: "Author data tracked by links to references."
        // });


		// new Setting(containerEl)
			// .setName("Create author notes automatically")
			// .setDesc("Enable or disable creation or updating of linked author notes when creating or updating bibliographic notes.")
			// .addToggle(toggle => toggle
					// .setValue(this.configuration.isCreateAuthorNotes)
					// .onChange(async (value) => {
						// this.configuration.isCreateAuthorNotes = value;
						// await this.saveSettings();
		// }));

		// new Setting(containerEl)
			// .setName("Author notes folder")
			// .setDesc("Path to folder of author notes.")
			// .addText(text => text
				// .setPlaceholder("(E.g. 'sources/authors')")
				// .setValue(this.configuration.authorNoteParentFolderPath)
				// .onChange(async (value) => {
					// this.configuration.authorNoteParentFolderPath = value;
					// await this.saveSettings();
		// }));
		// new Setting(containerEl)
			// .setName("Organize author notes into subdirectories based on names")
			// .setDesc("Enable or disable lexical organization of author notes into subdirectories.")
			// .addToggle(toggle => toggle
				// .setValue(this.configuration.isSubdirectorizeAuthorNotesLexically)
				// .onChange(async (value) => {
					// this.configuration.isSubdirectorizeAuthorNotesLexically = value;
					// await this.saveSettings();
        // }));
		// new Setting(containerEl)
			// .setName("Bibliographic note backlink property name:")
			// .setDesc("Front matter metadata property on author note linking to associated bibliographic note.")
			// .addText(text => text
				// .setPlaceholder("(E.g. 'author-references')")
				// .setValue(this.configuration.authorBiblioNoteOutlinkPropertyName)
				// .onChange(async (value) => {
					// this.configuration.authorBiblioNoteOutlinkPropertyName = value
					// await this.saveSettings();
		// }));

        // new Setting(containerEl)
        //     .setName("Tag metadata")
        //     .setDesc("Enter tags to be added, separated by newlines, spaces, commas, or semicolons.")
        //     .addTextArea(text => {
        //         text.setPlaceholder("#source/author")
        //             .setValue(this.configuration.authorNoteTagMetadata?.join("\n") || "")
        //             .onChange(async (value) => {
        //                 this.configuration.authorNoteTagMetadata = splitStringArray(value);
        //                 await this.saveSettings();
        //             });
        //         // text.inputEl.style.height = "8rem";
        //     });


		// this.manageAdditionalPropertiesSettings(
			// containerEl,
			// "authorNoteAdditionalMetadata",
		// )

        containerEl.createEl("h2", { text: `Associated notes` })
		this.configuration.associatedNotes.forEach( (noteConfig: NoteConfiguration) => {
		    const className = noteConfig.className || "";
		    containerEl.createEl("h3", { text: `${className} notes` })
            if (noteConfig.description) {
                containerEl.createEl("p", {
                    text: noteConfig.description,
                });
            }
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
            	.setName("Name composition: prefix")
            	.setDesc("String to prefix in front of base file name to disambiguate it from reference.")
            	.addText(text => text
            		.setPlaceholder(`(E.g. '${className.toLowerCase()}_')`)
            		.setValue(noteConfig.namePrefix)
            		.onChange(async (value) => {
            			noteConfig.namePrefix = value;
            			await this.saveSettings();
            }));
            new Setting(containerEl)
            	.setName("Name composition: postfix")
            	.setDesc("String to append to back of base file name to disambiguate it from reference.")
            	.addText(text => text
            		.setPlaceholder(`(E.g. '_${className.toLowerCase()}')`)
            		.setValue(noteConfig.namePostfix)
            		.onChange(async (value) => {
            			noteConfig.namePostfix = value;
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
                .setDesc("Enter tags to be added, separated by newlines, spaces, commas, or semicolons.")
                .addTextArea(text => {text
            		.setPlaceholder(`(E.g. '#source/${className.toLowerCase()}')`)
                    .setValue(noteConfig.tagMetadata?.join("\n") || "")
                    .onChange(async (value) => {
                        noteConfig.tagMetadata = splitStringArray(value);
                        await this.saveSettings();
                     });
            });

		});

		containerEl.createEl("h2", { text: "Holdings" })

		new Setting(containerEl)
			.setName("Holdings folder")
			.setDesc("Path to parent or root folder of holdings (attachments). Leave blank to store alongside bibliographic file.")
			.addText(text => text
				.setPlaceholder("(E.g. 'sources/references')")
				.setValue(this.configuration.holdingsParentFolder)
				.onChange(async (value) => {
					this.configuration.holdingsParentFolder = value;
					await this.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Holdings outlink property name:")
			.setDesc("Name of property on bibliographic note to update with link to imported holdings.")
			.addText(text => text
				.setPlaceholder("(E.g. 'attachments' or 'pdfs')")
				.setValue(this.configuration.holdingsPropertyName)
				.onChange(async (value) => {
					this.configuration.holdingsPropertyName = value;
					await this.saveSettings();
		}));
	}

	manageAdditionalPropertiesSettings(
		containerEl: HTMLElement,
		configurationPropertyName: "biblioNoteAdditionalMetadata" | "authorNoteAdditionalMetadata",
		configurationPropertyDisplayName: string = "Additional front matter properties (YAML)",
		configurationPropertyParameterInitialDescription: string = "Other front matter metadata properties to be updated specified in YAML.",
		configurationPropertyParameterPlaceholder: string = "(E.g., 'reference-case: Project 1', 'reading-priority: medium')",
	) {
			let currentAdditionalPropertiesString: string = "";
			if (this.configuration[configurationPropertyName]) {
				let cachedValue: FilePropertyData = this.configuration[configurationPropertyName] as FilePropertyData
				if (cachedValue) {
					currentAdditionalPropertiesString = stringifyYaml(cachedValue)
				}
			}
			let refPropertiesSetting = new Setting(containerEl)
			.setName(configurationPropertyDisplayName)
			.setDesc(configurationPropertyParameterInitialDescription)
			.addTextArea(text => {
				text.setPlaceholder(configurationPropertyParameterPlaceholder)
				.setValue(currentAdditionalPropertiesString);
				// text.inputEl.style.height = "8rem"
				text.inputEl.addEventListener("blur", async () => {
					try {
						let refProperties: FilePropertyData = parseYaml(text.getValue());
						// refPropertiesSetting.setDesc("YAML parsed successfully. Recognized fields: " + Object.keys(refProperties).join(", "));
						// refPropertiesSetting.setDesc(`YAML parsed successfully: ${refProperties}`)
						refPropertiesSetting.descEl.empty()
						createFilePropertyDataTable(refPropertiesSetting.descEl, refProperties)
						// this.configuration.biblioNoteAdditionalMetadata = stringifyYaml(refProperties);
						// this.configuration[configurationPropertyName] = refProperties;
						this.configuration[configurationPropertyName] = refProperties
						await this.saveSettings();
					} catch (error) {
						refPropertiesSetting.setDesc("YAML Parse Error: " + error.message);
					}
				});
			});
	}


}

