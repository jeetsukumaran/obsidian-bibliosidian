
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
	// createBiblioNote,
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

type SettingType = "text" | "toggle" | "textarea";

interface SettingOptionConfiguration<T extends keyof NoteConfiguration> {
    key: T;                         // The property key in noteConfig
    name: string;                    // Display name
    description: string;              // Tooltip description
    type: SettingType;                // Type: text, toggle, textarea
    placeholder?: string;             // Placeholder for text inputs
    disallowEmpty?: boolean;          // Whether empty values are allowed
    isDisabled?: boolean;             // Whether the settingOptionConfiguration should be disabled
}

function createSetting<T extends keyof NoteConfiguration>(
    containerEl: HTMLElement,
    noteConfig: NoteConfiguration,
    settingOptionConfiguration: SettingOptionConfiguration<T>,
    saveSettings: () => Promise<void>,
    // excludeElements: { [key: string]: boolean },
) {
    if (!(settingOptionConfiguration.key in noteConfig)) {
        console.warn(`Invalid settingOptionConfiguration key: ${settingOptionConfiguration.key}`);
        return;
    }

    const expandVars = (val: string) =>  val.replace(/{{notetype}}/g, (noteConfig.className?.toLowerCase() || "{{notetype}}"));
    const settingEl = new Setting(containerEl)
        .setName(settingOptionConfiguration.name)
        .setDesc(settingOptionConfiguration.description);

    if (settingOptionConfiguration.type === "toggle") {
        settingEl.addToggle(toggle =>
            toggle.setValue(noteConfig[settingOptionConfiguration.key] as boolean)
                  .setDisabled(settingOptionConfiguration.isDisabled ?? false)
                  .onChange(async (newValue) => {
                      noteConfig[settingOptionConfiguration.key] = newValue as NoteConfiguration[T];  // Type assertion
                      await saveSettings();
                  })
        );
    } else if (settingOptionConfiguration.type === "textarea") {
        settingEl.addTextArea(textarea =>
            textarea.setPlaceholder(expandVars(settingOptionConfiguration.placeholder || ""))
                    .setValue(Array.isArray(noteConfig[settingOptionConfiguration.key]) ? (noteConfig[settingOptionConfiguration.key] as string[]).join("\n") : (noteConfig[settingOptionConfiguration.key] as string))
                    .setDisabled(settingOptionConfiguration.isDisabled ?? false)
                    .onChange(async (newValue) => {
                        noteConfig[settingOptionConfiguration.key] = newValue.split(/\s*[\n,;]\s*/) as NoteConfiguration[T];  // Type assertion
                        await saveSettings();
                    })
        );
    } else { // "text"
        settingEl.addText(text => {
            let tempValue = noteConfig[settingOptionConfiguration.key] as string;

            text.setPlaceholder(expandVars(settingOptionConfiguration.placeholder || ""))
                .setValue(tempValue)
                .setDisabled(settingOptionConfiguration.isDisabled ?? false)
                .onChange((newValue) => {
                    tempValue = newValue.trim(); // Store temporary value
                })
                .then(text => {
                    text.inputEl.addEventListener("blur", async () => {
                        if (settingOptionConfiguration.disallowEmpty && !tempValue) {
                            new Notice(`${settingOptionConfiguration.name} cannot be empty.`);
                            text.setValue(noteConfig[settingOptionConfiguration.key] as string); // Restore previous value
                            return;
                        }
                        noteConfig[settingOptionConfiguration.key] = tempValue as NoteConfiguration[T];  // Type assertion
                        await saveSettings();
                    });
                });
        });
    }
}

const settingOptionConfigurations: SettingOptionConfiguration<keyof NoteConfiguration>[] = [
    {
        key: "isAutoCreate",
        name: "Create automatically",
        description: "Enable or disable automatic creation when importing or updating bibliographic notes.",
        type: "toggle"
    },

    {
        key: "parentFolderPath",
        name: "Parent folder",
        description: "Path to parent folder of notes.",
        type: "text",
        placeholder: "(E.g. 'sources/{{notetype}}')",
        disallowEmpty: true
    },

    {
        key: "isSubdirectorizeLexically",
        name: "Organize into subdirectories based on source names",
        description: "Enable or disable lexical organization of notes into subdirectories.",
        type: "toggle"
    },

    {
        key: "namePrefix",
        name: "Name composition: prefix",
        description: "String to prefix in front of base file name to disambiguate it from reference.",
        type: "text",
        placeholder: "(E.g. '{{notetype}}_')"
    },

    {
        key: "namePostfix",
        name: "Name composition: postfix",
        description: "String to append to back of base file name to disambiguate it from reference.",
        type: "text",
        placeholder: "(E.g. '_{{notetype}}')"
    },

    {
        key: "frontmatterPropertyNamePrefix",
        name: "Front matter property name prefix",
        description: "Front matter metadata property will be prefixed by this.",
        type: "text",
        placeholder: "(E.g. '{{notetype}}-')"
    },

    {
        key: "associatedNotesOutlinkPropertyName",
        name: "Associated notes outlink property name",
        description: "Front matter property name of links to this class of notes from other notes: what do other notes call this class of note when linking to it? Use a plural form to allow for multiple links.",
        type: "text",
        placeholder: "references, authors, extracts, readings",
        disallowEmpty: true
    },

    {
        key: "tagMetadata",
        name: "Tag metadata",
        description: "Enter tags to be added, separated by newlines, spaces, commas, or semicolons.",
        type: "textarea",
        placeholder: "(E.g. '#source/{{notetype}}')"
    },
];


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
        excludeElements: { [key: string]: boolean }
    ) {
        const className = noteConfig.className || "";

        if (!excludeElements["header"]) {
            containerEl.createEl("h3", { text: `${className} notes` });
        }

        if (!excludeElements["description"] && noteConfig.description) {
            containerEl.createEl("p", { text: noteConfig.description });
        }

        for (const settingOptionConfiguration of settingOptionConfigurations) {
            if (!excludeElements[settingOptionConfiguration.key]) {
                createSetting(containerEl, noteConfig, settingOptionConfiguration, this.saveSettings.bind(this));
            }
        }
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

