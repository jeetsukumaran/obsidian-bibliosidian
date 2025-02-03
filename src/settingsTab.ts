
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
        new Setting(containerEl)
            .setName("Organize into subdirectories based on source names")
            .setDesc("Enable or disable lexical organization of notes into subdirectories.")
            .addToggle(toggle => toggle
                .setValue(noteConfig.isSubdirectorizeLexically)
                .onChange(async (value) => {
                    noteConfig.isSubdirectorizeLexically = value;
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
        if (!excludeElements["frontmatterPropertyNamePrefix"]) {
            new Setting(containerEl)
                .setName("Front matter property name prefix")
                .setDesc("Front matter metadata property will be prefixed by this.")
                .addText(text => text
                    .setPlaceholder(`(E.g. '${className.toLowerCase()}-')`)
                    .setValue(noteConfig.frontmatterPropertyNamePrefix)
                    .onChange(async (value) => {
                        noteConfig.frontmatterPropertyNamePrefix = value
                        await this.saveSettings();
            }));
        }
        if (!excludeElements["associatedNotesOutlinkPropertyName"]) {
            new Setting(containerEl)
                .setName("Associated notes outlink property name")
                .setDesc("Front matter metadata property name that other notes call this note. Use plural to allow for multiple links.")
                .addText(text => text
                    .setPlaceholder(`(E.g. 'references', 'authors', 'extracts', 'readings')`)
                    .setValue(noteConfig.associatedNotesOutlinkPropertyName)
                    .onChange(async (value) => {
                        noteConfig.associatedNotesOutlinkPropertyName = value
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

		Object.keys(this.configuration.settings.coreNoteConfigurations).forEach( (noteConfigKey: string) => {
		    const noteConfig: NoteConfiguration = this.configuration.settings.coreNoteConfigurations[noteConfigKey];
            this.setupNoteConfigurationSettings(
                containerEl,
                noteConfig,
                {
                    "isAutoCreate": true,
                },
            );
		});

        containerEl.createEl("h2", { text: `Associated notes` })

		Object.keys(this.configuration.settings.associatedNoteConfigurations).forEach( (noteConfigKey: string) => {
		    const noteConfig: NoteConfiguration = this.configuration.settings.associatedNoteConfigurations[noteConfigKey];
            this.setupNoteConfigurationSettings(
                containerEl,
                noteConfig,
                {},
            );
		});


		containerEl.createEl("h2", { text: "Holdings" })

		new Setting(containerEl)
			.setName("Holdings folder")
			.setDesc("Path to parent or root folder of holdings (attachments). Leave blank to store alongside bibliographic file.")
			.addText(text => text
				.setPlaceholder("(E.g. 'sources/references')")
				.setValue(this.configuration.settings.holdingsParentFolder)
				.onChange(async (value) => {
					this.configuration.settings.holdingsParentFolder = value;
					await this.saveSettings();
		}));
		new Setting(containerEl)
			.setName("Holdings outlink property name:")
			.setDesc("Name of property on bibliographic note to update with link to imported holdings.")
			.addText(text => text
				.setPlaceholder("(E.g. 'attachments' or 'pdfs')")
				.setValue(this.configuration.settings.holdingsPropertyName)
				.onChange(async (value) => {
					this.configuration.settings.holdingsPropertyName = value;
					await this.saveSettings();
		}));
	}

	// manageAdditionalPropertiesSettings(
	// 	containerEl: HTMLElement,
	// 	configurationPropertyName: "biblioNoteAdditionalMetadata" | "authorNoteAdditionalMetadata",
	// 	configurationPropertyDisplayName: string = "Additional front matter properties (YAML)",
	// 	configurationPropertyParameterInitialDescription: string = "Other front matter metadata properties to be updated specified in YAML.",
	// 	configurationPropertyParameterPlaceholder: string = "(E.g., 'reference-case: Project 1', 'reading-priority: medium')",
	// ) {
	// 		let currentAdditionalPropertiesString: string = "";
	// 		if (this.configuration[configurationPropertyName]) {
	// 			let cachedValue: FilePropertyData = this.configuration[configurationPropertyName] as FilePropertyData
	// 			if (cachedValue) {
	// 				currentAdditionalPropertiesString = stringifyYaml(cachedValue)
	// 			}
	// 		}
	// 		let refPropertiesSetting = new Setting(containerEl)
	// 		.setName(configurationPropertyDisplayName)
	// 		.setDesc(configurationPropertyParameterInitialDescription)
	// 		.addTextArea(text => {
	// 			text.setPlaceholder(configurationPropertyParameterPlaceholder)
	// 			.setValue(currentAdditionalPropertiesString);
	// 			// text.inputEl.style.height = "8rem"
	// 			text.inputEl.addEventListener("blur", async () => {
	// 				try {
	// 					let refProperties: FilePropertyData = parseYaml(text.getValue());
	// 					// refPropertiesSetting.setDesc("YAML parsed successfully. Recognized fields: " + Object.keys(refProperties).join(", "));
	// 					// refPropertiesSetting.setDesc(`YAML parsed successfully: ${refProperties}`)
	// 					refPropertiesSetting.descEl.empty()
	// 					createFilePropertyDataTable(refPropertiesSetting.descEl, refProperties)
	// 					// this.configuration.biblioNoteAdditionalMetadata = stringifyYaml(refProperties);
	// 					// this.configuration[configurationPropertyName] = refProperties;
	// 					this.configuration[configurationPropertyName] = refProperties
	// 					await this.saveSettings();
	// 				} catch (error) {
	// 					refPropertiesSetting.setDesc("YAML Parse Error: " + error.message);
	// 				}
	// 			});
	// 		});
	// }


}

