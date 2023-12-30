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

import {
	generateAuthorLinks,
	updateYAMLProperty,
	generateSourceFrontmatter,
} from "./references"


interface BibliosidianSettings {
	mySetting: string;
	referenceSourcePropertiesPrefix: string;
	referenceSourceBibTex: string
}

const DEFAULT_SETTINGS: BibliosidianSettings = {
	mySetting: 'default',
	referenceSourcePropertiesPrefix: "source-",
	referenceSourceBibTex: "entry-bibtex",
}


interface BibTexModalArgs {
    targetFilepath: string;
    sourceBibTex: string;
    onGenerate: (args: { targetFilepath: string, sourceBibTex: string }) => void;
    onCancel: () => void;
}

class BibTexModal extends Modal {
    args: BibTexModalArgs;
    targetFilepathInput: HTMLInputElement;
    sourceBibTexTextarea: HTMLTextAreaElement;

    constructor(app: App, args: BibTexModalArgs) {
        super(app);
        this.args = args;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: "Reference data update" });

        contentEl.createEl("h4", { text: "Target filepath" });
        this.targetFilepathInput = contentEl.createEl("input", {
            type: "text",
            value: this.args.targetFilepath
        });
		this.targetFilepathInput.style.width = "100%" // this needs to be css

        contentEl.createEl("h4", { text: "Source BibTex" });
        this.sourceBibTexTextarea = contentEl.createEl("textarea", {
        });
		this.sourceBibTexTextarea.textContent = this.args.sourceBibTex
		this.sourceBibTexTextarea.style.width = "100%" // this needs to be css
		this.sourceBibTexTextarea.style.height = "16rem"

        let buttonContainer = contentEl.createEl("div");
        buttonContainer.style.textAlign = "right"
        // Buttons
        const generateButton = buttonContainer.createEl("button", { text: "Generate" });
        generateButton.onclick = () => {
            this.args.onGenerate({
                targetFilepath: this.targetFilepathInput.value,
                sourceBibTex: this.sourceBibTexTextarea.value
            });
            this.close();
        };

        const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
        cancelButton.onclick = () => {
            this.args.onCancel();
            this.close();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export default class Bibliosidian extends Plugin {
	settings: BibliosidianSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("book-plus", "Update properties from reference data", () => {
			let activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				return
			}
			let defaultBibTex = ""
			let frontmatter = app.metadataCache?.getFileCache(activeFile)?.frontmatter
			if (frontmatter) {
				defaultBibTex = frontmatter?.["entry-bibtex"] || defaultBibTex
			}
			const bibtexModal = new BibTexModal(app, {
				targetFilepath: activeFile.path,
				sourceBibTex: defaultBibTex,
				onGenerate: (args) => {

					generateSourceFrontmatter(
						this.app,
						args.targetFilepath,
						args.sourceBibTex,
						undefined,
						"sources/authors",
					)

					// Authors
					// let authorLinks = generateAuthorLinks(
					// 	args.sourceBibTex,
					// 	undefined,
					// 	"sources/authors",
					// )
					// if (authorLinks && activeFile) {
					// 	updateYAMLProperty(
					// 		this.app,
					// 		activeFile.path,
					// 		`${this.settings.referenceSourcePropertiesPrefix}authors`,
					// 		authorLinks,
					// 	)
					// }

				},
				onCancel: () => {
					// console.log('Cancel clicked');
				}
			});
			bibtexModal.open();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new BibliosidianSettingTab(this.app, this));
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

// Usage Example
// const app = new App(); // Placeholder for the actual app instance
// const modal = new BibTexModal(app, {
//     targetFilepath: 'default/filepath',
//     sourceBibTex: 'default bibtex content',
//     onGenerate: (args) => {
//         console.log('Generate clicked', args);
//     },
//     onCancel: () => {
//         console.log('Cancel clicked');
//     }
// });

// modal.open();



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
