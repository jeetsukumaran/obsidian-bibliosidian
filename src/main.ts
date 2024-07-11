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
			.setName("Source BibTex property name")
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


		this.addRibbonIcon("library-square", "Update multiple biblioNotes from a BibTeX bibliography database file", () => {
			this.updateBiblioNoteLibraryFromBibTex()
		});
		this.addRibbonIcon("book-up-2", "Create or update bibliographic note from BibTeX data", () => {
			this.updateBiblioNoteFromBibTex()
		});
		this.addRibbonIcon("book-plus", "Add a holding associated with this bibliographic note", () => {
			this.addHolding()
		});


		this.addCommand({
			id: 'bibliosidian-update-biblionote-from-bibtex',
			name: 'Update active file properties from BibTeX',
			callback: this.updateBiblioNoteFromBibTex,
		});

		this.addCommand({
			id: 'bibliosidian-update-biblioNote-library-from-bibtex',
			name: 'Update multiple bibliographical notes from a BibTeX bibliography database file',
			callback: this.updateBiblioNoteLibraryFromBibTex,
		});
		this.addCommand({
			id: 'bibliosidian-add-holding',
			name: 'Add a holding associated with this note',
			callback: this.addHolding,
		});

        this.addCommand({
            id: 'generatecitation-list',
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
		let sourceBibTex = `
@article{agapow2004impact,
  title = {The impact of species concept on biodiversity studies},
  author = {Agapow, Paul‐Michael and Bininda‐Emonds, Olaf~R~P and Crandall, Keith~A and Gittleman, John~L and Mace, Georgina~M and Marshall, Jonathon~C and Purvis, Andy},
  year = {2004},
  month = jun,
  journal = {The Quarterly Review of Biology},
  volume = {79},
  number = {2},
  pages = {161--179},
  publisher = {The University of Chicago Press},
  issn = {0033-5770},
  doi = {10.1086/383542},
  url = {https://www.journals.uchicago.edu/doi/full/10.1086/383542},
  urldate = {2022-08-02},
  abstract = {Species are defined using a variety of different operational techniques. While discussion of the various methodologies has previously been restricted mostly to taxonomists, the demarcation of species is also crucial for conservation biology. Unfortunately, different methods of diagnosing species can arrive at different entities. Most prominently, it is widely thought that use of a phylogenetic species concept may lead to recognition of a far greater number of much less inclusive units. As a result, studies of the same group of organisms can produce not only different species identities but also different species range and number of individuals. To assess the impact of different definitions on conservation issues, we collected instances from the literature where a group of organisms was categorized both under phylogenetic and nonphylogenetic concepts. Our results show a marked difference, with surveys based on a phylogenetic species concept showing more species (48\%) and an associated decrease in population size and range. We discuss the serious consequences of this trend for conservation, including an apparent change in the number of endangered species, potential political fallout, and the difficulty of deciding what should be conserved.},
  file = {/home/jeetsukumaran/site/storage/local/reference/libraries/zotero/storage/VXKNQBM9/agapow2004impact.pdf}
}

@article{balakrishnan2005species,
  title = {Species concepts, species boundaries and species identification: a view from the tropics},
  shorttitle = {Species concepts, species boundaries and species identification},
  author = {Balakrishnan, Rohini},
  year = {2005},
  month = aug,
  journal = {Systematic Biology},
  volume = {54},
  number = {4},
  pages = {689--693},
  issn = {1063-5157},
  doi = {10.1080/10635150590950308},
  url = {https://doi.org/10.1080/10635150590950308},
  urldate = {2022-08-02},
  abstract = {The species has been treated as a fundamental unit in biology (Hull, 1977) and, more recently, in biodiversity conservation (Sites and Crandall, 1997). Almost all studies in biology, whether at the level of molecules, cells, individuals or populations, are typically referenced to the level of the species. In the field of conservation biology, assessments of biodiversity are made at the level of the species: typical criteria include species richness, numbers of endemic species, and the number or presence of endangered species in given areas (Myers et al. 2000). The accurate identification of species is crucial both to research in all areas of biology and to biodiversity conservation. It is therefore surprising that, in the field of systematics, species are currently used mostly as terminal taxa in the reconstruction of phylogenetic trees, whereas the methods by which they are delimited and identified receive scant attention (Wiens and Penkrot, 2002).},
  file = {/home/jeetsukumaran/site/storage/local/reference/libraries/zotero/storage/SPXGZDU8/balakrishnan2005species.pdf}
}

@article{kunz2002when,
  title = {When is a parasite species a species?},
  author = {Kunz, Werner},
  year = {2002},
  month = mar,
  journal = {Trends in Parasitology},
  volume = {18},
  number = {3},
  pages = {121--124},
  issn = {1471-4922},
  doi = {10.1016/S1471-4922(01)02210-3},
  url = {https://www.sciencedirect.com/science/article/pii/S1471492201022103},
  urldate = {2022-08-02},
  abstract = {Regrettably, 140 years after the publication of Darwin's Origin of Species, we face the grotesque situation that we still do not know what is a species whose origin Darwin wanted to explain. A generally applicable species definition is not available. Is there a basic unit of biodiversity above the level of individuals? Do we try to define something that does not exist in reality? The strong potential for the evolution of genetic variability in parasites together with the importance of species diagnosis for applied fields of parasite research make biodiversity research a key role in parasitology. Frequent occurrence of sympatric speciation, clonal reproduction, selfing, sib mating or parthenogenesis imply exceptional conditions for the evolution of gene pool diversities in parasites.},
  langid = {english},
  file = {/home/jeetsukumaran/site/storage/local/reference/libraries/zotero/storage/NRPFAEI5/kunz2002when.pdf;/home/jeetsukumaran/site/storage/local/reference/libraries/zotero/storage/J4RWYHPC/kunz2002when.html}
}

@article{noor2002biological,
  title = {Is the biological species concept showing its age?},
  author = {Noor, Mohamed A. F},
  year = {2002},
  month = apr,
  journal = {Trends in Ecology \& Evolution},
  volume = {17},
  number = {4},
  pages = {153--154},
  issn = {0169-5347},
  doi = {10.1016/S0169-5347(02)02452-7},
  url = {https://www.sciencedirect.com/science/article/pii/S0169534702024527},
  urldate = {2022-08-02},
  abstract = {A recent paper by Chung-I Wu in the Journal of Evolutionary Biology questions the value of the popular biological species concept (BSC) and offers an alternative ‘genic’ concept based on possessing ‘loci of differential adaptation.’ Wu suggests that recent empirical results from genetic studies of speciation necessitate this revision. Several prominent evolutionary biologists responded in the same issue, many noting excitement over the recent empirical results, few agreeing with an abandonment of the BSC, and none wholeheartedly embracing the new genic concept.},
  langid = {english},
  file = {/home/jeetsukumaran/site/storage/local/reference/libraries/zotero/storage/7XLTZLPP/noor2002biological.pdf}
}

		`
		generateBiblioNoteLibrary(
			this.app,
			sourceBibTex,
			this.settings,
			// this.settings.biblioNoteSourcePropertiesPrefix,
			// this.settings.biblioNoteSubdirectoryRoot,
			// this.settings.isSubdirectorizeBiblioNotesLexically,
			// this.settings.authorsParentFolderPath,
			// this.settings.isSubdirectorizeAuthorsLexically,
			// this.settings.isCreateAuthorPages,
		)

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

