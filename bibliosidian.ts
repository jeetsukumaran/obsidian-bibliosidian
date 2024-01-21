import {
	App,
	TFile,
	CachedMetadata,
	PaneType,
	// Editor,
	// MarkdownView,
	Modal,
	Notice,
	// Plugin,
	// PluginSettingTab,
	Setting,
	BaseComponent,
	ButtonComponent,
	TextComponent,
	TextAreaComponent,
	// WorkspaceLeaf,
	// setIcon,
} from 'obsidian';

import {
	parseBibFile,
	normalizeFieldValue,
	BibEntry,
	EntryFields,
	FieldValue,
} from "bibtex";

import {
	FileProperties,
	FilePropertyData,
	updateFileProperties,
	// updateFrontmatterYaml,
} from "./fileProperties"


// import { parseBibFile } from "bibtex";
import * as _path from "path";

export interface BibliosidianSettings {
	mySetting: string;
	referenceSourcePropertiesPrefix: string;
	referenceSourceBibTex: string
	referenceSubdirectoryRoot: string
	isSubdirectorizeReferencesLexically: boolean
	referenceAdditionalMetadata: FilePropertyData,
	authorsParentFolderPath: string
	isSubdirectorizeAuthorsLexically: boolean
	authorsAdditionalMetadata: FilePropertyData,
	isCreateAuthorPages: boolean,
}


interface BibTexModalArgs {
    sourceBibTex: string;
    targetFilepath: string;
	isCreateAuthorPages: boolean;
    isOpenNote: boolean;
}

interface Author {
    lastNames: string[],
    vons: string[],
    firstNames: string[],
    jrs: string[]
}


function composeAuthorData(author: Author): {
    displayName: string,
    normalizedFileName: string,
} {
    // Concatenate the author components in the specified order
    let displayNameParts: string[] = [
        ...author.lastNames,
        ...author.vons,
        ...author.firstNames,
        ...author.jrs
    ].filter(part => part && part.trim().length > 0); // Filter out empty parts

    // Normalize the string
    let normalizedFileName: string = (displayNameParts
                              .join("-")
                              .toLowerCase()
                              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                              .replace(/[^a-zA-Z0-9-]/g, "")
                              .replace(/\s+/g, "-")
                             ) || "author";

    return {
        displayName: displayNameParts.join(", "),
        normalizedFileName: normalizedFileName,
    }
}

function generateSourceFrontmatter(
	app: App,
	settings: BibliosidianSettings,
	args: BibTexModalArgs,
    citeKey?: string,
) {

	let bibToYamlLabelFn: (arg0:string) => string = (bibStr) => `${settings.referenceSourcePropertiesPrefix}${bibStr}`

    let { bibEntry, bibtexStr, fieldValueMap } = getBibEntry(args.sourceBibTex, citeKey)

    if (!bibEntry) {
    	new Notice("Reference data could not be resolved")
    	return
    }

    let refProperties: FilePropertyData  = {}

	let citekey = bibEntry._id.toLowerCase();
	let authorLastNames: string[] = [];
	let auFieldNames: string[] = [
	    "author",
    	"editor",
    ];
    auFieldNames.forEach( (auFieldName) => {
        const authorField = bibEntry?.getField(auFieldName);
        console.log(authorField);
        if (!authorField) {
            return;
        }
        console.log(authorField);
        try {
            (authorField as any)?.authors$?.forEach((author: any) => {
                let lastName = author?.lastNames ? author.lastNames.join(" ") : ""
                if (lastName) {
                    authorLastNames.push(lastName);
                }
            });
        } catch (error) {
            console.log(error);
        }
    });


    let cleanSingleLine = (s: string | undefined): string => {
        if (s) {
            return s.replace(/\s+/g, " ")
        } else {
            return ""
        }
    }

	let titleParts = [
		cleanSingleLine(bibEntry.getFieldAsString("title")?.toString()),
		cleanSingleLine(bibEntry.getFieldAsString("subtitle")?.toString()),
	].filter( (p) => p )
	let compositeTitle = cleanSingleLine(titleParts.join(": "))
	let sourceYear = normalizeFieldValue( bibEntry.getField("date") ) || normalizeFieldValue( bibEntry.getField("year") )
	let inTextCitationYear = sourceYear
	let inTextCitationAuthors: string;
	if (authorLastNames.length == 1) {
		inTextCitationAuthors = authorLastNames[0]
	} else if (authorLastNames.length == 2) {
		inTextCitationAuthors = `${authorLastNames[0]} and ${authorLastNames[1]}`
	} else {
		inTextCitationAuthors = `${authorLastNames[0]} et al.`
	}
	let inTextCitation: string = `(${inTextCitationAuthors.trim()} ${inTextCitationYear?.toString().trim()})`

	// This stuff is part of a related project: a multihierarchical indexing system
	// Should/will be abstracted out as part of custom user field creation
	let fileProperties = new FileProperties(this.app, args.targetFilepath)
	const updateDate = new Date();
	const updateDateStamp: string = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}-${String(updateDate.getDate()).padStart(2, '0')}T${String(updateDate.getHours()).padStart(2, '0')}:${String(updateDate.getMinutes()).padStart(2, '0')}:${String(updateDate.getSeconds()).padStart(2, '0')}`;

	// Add additional stuff
	// could try and merge with existing but right now, the additional m
	if (settings.referenceAdditionalMetadata) {
		refProperties = { ... refProperties, ... settings.referenceAdditionalMetadata }
	}


	let entryTitle = `**${inTextCitation}** ${compositeTitle}`
	refProperties["entry-title"] = entryTitle
    let authorLinks = generateAuthorLinks(
    	app,
		settings,
		args,
		bibEntry,
		`${inTextCitation} ${compositeTitle}`,
		"author",
	)
	// refProperties["entry-updated"] = updateDateStamp
	// refProperties["entry-updated"] = [ ... fileProperties.readPropertyList("entry-updated"), updateDateStamp]
	// refProperties["entry-updated"] = appendPropertyListItems("entry-updated", [updateDateStamp])
	refProperties["entry-updated"] = fileProperties.concatItems("entry-updated", [updateDateStamp])
	let authorBareLinks = authorLinks.map( (link) => link.bareLink )
	refProperties["entry-parents"] = fileProperties.concatItems("entry-parents", authorBareLinks)

    refProperties[bibToYamlLabelFn("citekey")] = citekey
    // refProperties[bibToYamlLabelFn("author")] = authorLinks.map( (link) => link.aliasedLink )
    refProperties[bibToYamlLabelFn("authors")] = authorLinks.map( (link) => link.aliasedLink )
    refProperties[bibToYamlLabelFn("date")] = sourceYear

    refProperties[bibToYamlLabelFn("title")] = compositeTitle

	refProperties[bibToYamlLabelFn("journal")] = bibEntry.getFieldAsString("journal")
	refProperties[bibToYamlLabelFn("volume")] = bibEntry.getFieldAsString("volume")
	refProperties[bibToYamlLabelFn("number")] = bibEntry.getFieldAsString("number")
	refProperties[bibToYamlLabelFn("pages")] = bibEntry.getFieldAsString("pages")
	refProperties[bibToYamlLabelFn("doi")] = bibEntry.getFieldAsString("doi")
	refProperties[bibToYamlLabelFn("url")] = bibEntry.getFieldAsString("url")
	refProperties[bibToYamlLabelFn("publisher")] = bibEntry.getFieldAsString("publisher")
	refProperties[bibToYamlLabelFn("booktitle")] = bibEntry.getFieldAsString("booktitle")
	refProperties[bibToYamlLabelFn("editor")] = bibEntry.getFieldAsString("editor")
	refProperties[bibToYamlLabelFn("keywords")] = bibEntry.getFieldAsString("keywords")
	refProperties[bibToYamlLabelFn("series")] = bibEntry.getFieldAsString("series")
	refProperties[bibToYamlLabelFn("address")] = bibEntry.getFieldAsString("address")
	refProperties[bibToYamlLabelFn("edition")] = bibEntry.getFieldAsString("edition")
	refProperties[bibToYamlLabelFn("chapter")] = bibEntry.getFieldAsString("chapter")
	refProperties[bibToYamlLabelFn("note")] = bibEntry.getFieldAsString("note")
	refProperties[bibToYamlLabelFn("institution")] = bibEntry.getFieldAsString("institution")
	refProperties[bibToYamlLabelFn("month")] = bibEntry.getFieldAsString("month")
	refProperties[bibToYamlLabelFn("school")] = bibEntry.getFieldAsString("school")
	refProperties[bibToYamlLabelFn("thesis")] = bibEntry.getFieldAsString("thesis")
	refProperties[bibToYamlLabelFn("howpublished")] = bibEntry.getFieldAsString("howpublished")
	refProperties[bibToYamlLabelFn("bibtex")] = bibtexStr


	let abstract = (bibEntry.getFieldAsString("abstract")?.toString() || "")
		.trim()
		.replace(/\n/g, " ")
		.replace(/\s+/g, " ")
	// let entryTitle = `(@${citekey}) ${compositeTitle}`

	refProperties["title"] = `${compositeTitle} ${inTextCitation}`
	if (abstract) {
		refProperties["abstract"] = abstract
	}
	refProperties["aliases"] = fileProperties.concatItems(
		"aliases",
		[
			`@${citekey}`,
			inTextCitation,
			compositeTitle,
		],
	)

    updateFileProperties(
    	this.app,
    	args.targetFilepath,
    	refProperties,
    	true,
    )
}


function getBibEntry(
    bibFileData: string,
    citeKey?: string,
): {
		bibEntry: BibEntry | undefined,
		bibtexStr: string,
		fieldValueMap: { [key: string]: string },
		indexTitle: string,
}{
    // bibFileData = bibFileData.replace(/\s+month\s+=\s+[A-Za-z]\s+,/g,"")
    // @article{wu2020phylogenetic,
  // title = {Phylogenetic {{Tree Inference}}: {{A Top-Down Approach}} to {{Track Tumor Evolution}}},
  // shorttitle = {Phylogenetic {{Tree Inference}}},
  // author = {Wu, Pin and Hou, Linjun and Zhang, Yingdong and Zhang, Liye},
  // year = {2020},
  // month = feb,
  // journal = {Frontiers in Genetics},
  // volume = {10},
  // pages = {1371},
  // issn = {1664-8021},
  // doi = {10.3389/fgene.2019.01371},
  // url = {https://www.frontiersin.org/article/10.3389/fgene.2019.01371/full},
  // urldate = {2023-11-30},
  // abstract = {Recently, an increasing number of studies sequence multiple biopsies of primary tumors, and even paired metastatic tumors to understand heterogeneity and the evolutionary trajectory of cancer progression. Although several algorithms are available to infer the phylogeny, most tools rely on accurate measurements of mutation allele frequencies from deep sequencing, which is often hard to achieve for clinical samples (especially FFPE samples). In this study, we present a novel and easy-to-use method, PTI (Phylogenetic Tree Inference), which use an iterative top-down approach to infer the phylogenetic tree structure of multiple tumor biopsies from same patient using just the presence or absence of somatic mutations without their allele frequencies. Therefore PTI can be used in a wide range of cases even when allele frequency data is not available. Comparison with existing state-of-the-art methods, such as LICHeE, Treeomics, and BAMSE, shows that PTI achieves similar or slightly better performance within a short run time. Moreover, this method is generally applicable to infer phylogeny for any other data sets (such as epigenetics) with a similar zero and one feature-by-sample matrix.},
  // langid = {english},
  // file = {/home/jeetsukumaran/site/storage/workspaces/reference/libraries/zotero/storage/V8SJ3JLH/Wu et al. - 2020 - Phylogenetic Tree Inference A Top-Down Approach t.pdf}
// }

    // bibFileData = bibFileData.replace(/month = feb,/g,"")
    // bibFileData = bibFileData.replace(/\s+?month\s*?=\s*[A-Za-z]+?\s*?,?$/g,"")
	const bibFile = parseBibFile(bibFileData);
	let entry: BibEntry | undefined;
	if (citeKey) {
		entry = bibFile.getEntry(citeKey);
	} else {
		if (bibFile.entries_raw && bibFile.entries_raw.length > 0) {
		}
		// Destructuring to get the first key and value
		let [[key, value]]: [string, BibEntry][] = Object.entries(bibFile.entries$);
		// // grab first key/val pair through destructuring
		// let [[ck, value]] = Object.entries(bibFile.entries$)
		entry = value
	}
	let fieldValueMap:{ [key: string]: string } = {}
	let bibtexStrParts = []
	if (entry !== undefined) {

		// let entryFields: EntryFields = bibEntry.fields$?.forEach( [key: string]: value: FieldValue
		let entryFields: EntryFields = entry.fields
		if (entryFields) {
			bibtexStrParts.push(`@${entry.type}{${entry._id},`)

			for (const key in entryFields) {
				if (entryFields.hasOwnProperty(key)) {
					const value: FieldValue = entryFields[key];
					if (value) {
						const valueStr = normalizeFieldValue(value)
						let fieldName = key
						let fieldValue = valueStr
						fieldValueMap[fieldName] = (fieldValue && fieldValue.toString()) || ""
						bibtexStrParts.push(`  ${fieldName} = {${fieldValue}},`)
					}
				}
			}

			// Object.entries(entryFields).forEach(([fieldName, fieldValue]: [string, FieldValue]) => {
			// 	let fieldValueStr = fieldValue ? normalizeFieldValue(fieldValue)?.toString() : ""
			// 	// fieldValueMap[fieldName] = (fieldValue && fieldValue.toString()) || ""
			// 	fieldValueMap[fieldName] = (fieldValue && fieldValue.toString()) || ""
			// 	bibtexStrParts.push(`  ${fieldName} = {${fieldValue}},`)
			// });

			bibtexStrParts.push("}")
		}

	}
	let indexTitle = ""
	return {
		bibEntry: entry,
		bibtexStr: bibtexStrParts.join("\n"),
		fieldValueMap: fieldValueMap,
		indexTitle: indexTitle,
	}
}

function generateAuthorLinks(
    app: App,
	settings: BibliosidianSettings,
	args: BibTexModalArgs,
    entry: BibEntry,
	entryTitle: string,
    authorFieldName: string = "author",
): { bareLink: string; aliasedLink: string; }[] {
    let results: { bareLink: string; aliasedLink: string; }[] = [];
    if (!entry) {
        return results;
    }
    if (authorFieldName === "author") {
        let authorLastNames: string[] = []
        const authorField = entry.getField(authorFieldName);
		const updateDate = new Date();
		const updateDateStamp: string = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}-${String(updateDate.getDate()).padStart(2, '0')}T${String(updateDate.getHours()).padStart(2, '0')}:${String(updateDate.getMinutes()).padStart(2, '0')}:${String(updateDate.getSeconds()).padStart(2, '0')}`;
        results = (authorField as any).authors$.map((author: any) => {
			let lastName = author?.lastNames ? author.lastNames.join(" ") : ""
			if (lastName) {
				authorLastNames.push(lastName)
			}
            const {
                displayName: authorDisplayName,
                normalizedFileName: authorFileName,
            } = composeAuthorData(author);
			let authorParentFolderPath: string;
			if (settings.isSubdirectorizeAuthorsLexically) {
				authorParentFolderPath = _path.join(settings.authorsParentFolderPath, authorFileName[0])
			} else {
				authorParentFolderPath = settings.authorsParentFolderPath
			}
            const authorFilePath = _path.join(authorParentFolderPath, authorFileName);
            if (args.isCreateAuthorPages) {
                let targetFilepath = authorFilePath;
                if (!targetFilepath.endsWith(".md")) {
					targetFilepath = targetFilepath + ".md"
                }
                createOrOpenNote(
                    app,
                    targetFilepath,
                    false,
                    false,
                )
                .then( (result) => {
					let fileProperties = new FileProperties(this.app, targetFilepath)
					let authorProperties: FilePropertyData = {};
					// Add additional stuff
					// could try and merge with existing but right now, the additional m
					if (settings.authorsAdditionalMetadata) {
						authorProperties = { ... authorProperties, ... settings.authorsAdditionalMetadata }
					}
					authorProperties["entry-updated"] = fileProperties.concatItems("entry-updated", [updateDateStamp])
					authorProperties["title"] = authorDisplayName;
					authorProperties["aliases"] = fileProperties.concatItems(
						"aliases",
						[
							authorDisplayName,
						],
					)
					let sourceLink = `[[${args.targetFilepath}|${entryTitle}]]`
					authorProperties["references"] = fileProperties
						.concatItems("references",
									 [sourceLink]
						)

					updateFileProperties(
						app,
						targetFilepath,
						authorProperties,
						true,
					)
					.then( (result) => { } )
					.catch( (error) => { } )
				})
				.catch( (error) => {} )
            }
            return {
                bareLink: `[[${authorFilePath}]]`,
                aliasedLink: `[[${authorFilePath}|${authorDisplayName}]]`,
            };
        });
    }
    return results;
}


function generateReference(
	app: App,
	settings: BibliosidianSettings,
	args: BibTexModalArgs,
	citeKey?: string,
) {
	if (!args.targetFilepath || args.targetFilepath.startsWith(".") || args.targetFilepath === ".md") {
		return
	}
	createOrOpenNote(
		this.app,
		args.targetFilepath,
		args.isOpenNote,
		false,
	)
	.then( (result) => {
		generateSourceFrontmatter(
			app,
			settings,
			args,
			citeKey,
		)
	})
	.catch( (error) => {} )
}

function computeBibEntryTargetFilePath(
	bibEntry: BibEntry,
	settings: BibliosidianSettings,
): string {
	let citekey = bibEntry._id
	let citekeyMarkedUp = `@${citekey}`
	let parentPath = settings.referenceSubdirectoryRoot
	if (settings.isSubdirectorizeReferencesLexically) {
		parentPath = _path.join(parentPath, replaceProblematicChars(citekey[0]))
	}
	return _path.join(parentPath, citekeyMarkedUp + ".md")
}

function replaceProblematicChars(input: string): string {
    const regex = /[:*?"<>|\/\\]/g;
    return input.replace(regex, "0");
}

class BibTexModal extends Modal {
    args: BibTexModalArgs;
	settings: BibliosidianSettings;
	parsedSourceTextAreaComponent: TextAreaComponent;
	referencePathTextComponent: TextAreaComponent
	isEnableReferencePathAutoUpdate: boolean = true
	onGenerate: (args:BibTexModalArgs) => void;
	private _parsedBibEntry: BibEntry | undefined = undefined
	private _parsedBibTexStr: string = ""
	private _parsedFieldValueMap: { [key: string]: string } = {}

    constructor(
		app: App,
		settings: BibliosidianSettings,
		onGenerate: (arg0:BibTexModalArgs) => void,
		args: BibTexModalArgs,
    ) {
        super(app);
        this.settings = settings
        this.args = args;
        this.onGenerate = onGenerate
    }

	buildParsedTextAreaComponent(
		containerEl: HTMLElement,
		initialValue: string = "",
	) {
		let parsedInputSetting = new Setting(containerEl)
			.setName("Source bibliographic data (BibTeX)")
			// .setDesc("Source definition (BibTex)")
			// .setDesc(initialDescription)
		let valuePlaceholder = (
`
E.g.:
    @article{kullback1951,
        title={On information and sufficiency},
        author={Kullback, Solomon and Leibler, Richard A},
        journal={The annals of mathematical statistics},
        volume={22},
        number={1},
        pages={79--86},
        year={1951},
        publisher={JSTOR}
    }
`
		)
		parsedInputSetting.addTextArea(text => {
			this.parsedSourceTextAreaComponent = text
			this.parsedSourceTextAreaComponent
				.setPlaceholder(valuePlaceholder)
				.setValue(initialValue);
			this.parsedSourceTextAreaComponent.inputEl.style.height = "16rem"
			this.parsedSourceTextAreaComponent.inputEl.style.overflow = "scroll"
			// this.parsedSourceTextAreaComponent.inputEl.style.width = "100%"
			let parseUpdatedValue = () => {
				try {
					let inputValue: string = this.parsedSourceTextAreaComponent.getValue();
					parsedInputSetting.descEl.empty()
					if (inputValue) {
						// as of 2024-01-16, the parser doesn't handle `month = feb`,
						// and lots of sources emit this
						let result = getBibEntry(inputValue)
						this._parsedBibEntry = result.bibEntry
						this._parsedBibTexStr = result.bibtexStr
						this._parsedFieldValueMap = result.fieldValueMap
						createKeyValueTable(parsedInputSetting.descEl, this._parsedFieldValueMap)
						if (this.isEnableReferencePathAutoUpdate) {
							this.setReferencePathTextComponentFromSource()
						}
					} else {
						this._parsedBibEntry = undefined
						this._parsedBibTexStr = ""
						this._parsedFieldValueMap = {}
					}
					// createFilePropertyDataTable(refPropertiesSetting.descEl, refProperties)
				} catch (error) {
					console.log(error);
					parsedInputSetting.setDesc("Parse error: " + error.message);
				}
			}
			parseUpdatedValue()
			this.parsedSourceTextAreaComponent.inputEl.addEventListener("blur", async () => {
				parseUpdatedValue()
			});
			let toolPanel = containerEl.createEl("div", { cls: ["model-input-support-panel"] })
			let panelSetting = new Setting(toolPanel)
			panelSetting.addButton( (button: ButtonComponent) => {
				button
				.setButtonText("Reset")
				.onClick( () => {
					this.parsedSourceTextAreaComponent.setValue(initialValue)
					parseUpdatedValue()
				});
			});
		});
	}

	setReferencePathTextComponentFromSource() {
		if (this._parsedBibEntry) {
			let filePath = computeBibEntryTargetFilePath(
				this._parsedBibEntry,
				this.settings,
			)
			this.referencePathTextComponent.setValue(filePath)
		} else {
		}
	}

	renderReferenceLocationInputTextArea(
		containerEl: HTMLElement,
		initialValue: string = "",
	) {
		let inputSetting = new Setting(containerEl)
			.setName("Reference note path")
			.setDesc("Path to file in folder where this reference will be stored.")
		inputSetting.addTextArea(text => {
			this.referencePathTextComponent = text
			this.referencePathTextComponent.setValue(initialValue);
			this.referencePathTextComponent.inputEl.addEventListener("blur", async () => {
				// parseUpdatedValue()
			});
			this.referencePathTextComponent.inputEl.style.height = "4rem"
			this.referencePathTextComponent.inputEl.style.overflow = "scroll"
		});

		let toolPanel = containerEl.createEl("div", { cls: ["model-input-support-panel"] })
		let panelSetting = new Setting(toolPanel)
		panelSetting.addToggle( toggle => {
			toggle
				.setValue(this.isEnableReferencePathAutoUpdate)
				.onChange(async (value) => {
					this.isEnableReferencePathAutoUpdate = value;
				})
		})

		panelSetting.addButton( (button: ButtonComponent) => {
			button
			.setButtonText("Auto")
			.onClick( () => {
				this.setReferencePathTextComponentFromSource()
			});
		});
		panelSetting.addButton( (button: ButtonComponent) => {
			button
			.setButtonText("Reset")
			.onClick( () => {
				this.referencePathTextComponent.setValue(initialValue)
			});
		});
	}

    onOpen() {
        const { contentEl } = this;
		contentEl.createEl("h1", { text: "Reference update" })

		contentEl.createEl("h2", { text: "Source" })
		let referenceSourceBibTexComponent = this.buildParsedTextAreaComponent(
			contentEl,
			this.args.sourceBibTex,
		)

		contentEl.createEl("h2", { text: "Reference" })
		this.renderReferenceLocationInputTextArea(
			contentEl,
			this.args.targetFilepath,
		)

		contentEl.createEl("h2", { text: "Authors" })
		let updateAuthorsSettings = new Setting(contentEl)
		updateAuthorsSettings
			.setName("Update source author notes")
			.setDesc("Create or update associated source author notes.")
			// .setDesc("Create or update reference and associated author notes.")
		updateAuthorsSettings.addToggle( toggle => {
			toggle
				.setValue(this.args.isCreateAuthorPages)
				.onChange(async (value) => {
					this.args.isCreateAuthorPages = value;
				})
		})

		contentEl.createEl("h2", { text: "Update" })

		let execute = (isQuiet: boolean = true) => {
			this.args.targetFilepath = this.referencePathTextComponent.getValue().endsWith(".md") ? this.referencePathTextComponent.getValue() : this.referencePathTextComponent.getValue() + ".md"
			this.args.sourceBibTex = this.parsedSourceTextAreaComponent.getValue()
			this.onGenerate(this.args);
			if (!isQuiet) {
				new Notice(`Reference updated: '${this.args.targetFilepath}' `)
			}
			this.close();
		}

		let runUpdate = new Setting(contentEl)
			// .setName("Update")
		runUpdate
			.addButton( (button: ButtonComponent) => {
				button
				.setButtonText("Update")
				.onClick( () => {
					this.args.isOpenNote = false
					execute(false)
				});
			})
			.addButton( (button: ButtonComponent) => {
				button
				.setButtonText("Update and Open")
				.onClick( () => {
					this.args.isOpenNote = true
					execute(true)
				});
			});


    }


    // onOpen() {
    //     const { contentEl } = this;
		// contentEl.createEl("h1", { text: "Reference update" })
		// contentEl.createEl("h2", { text: "Source" })

    //     // Source BibTex section
    //     contentEl.createEl("h3", { text: "BibTex" });
    //     this.sourceBibTexTextarea = contentEl.createEl("textarea");
    //     this.sourceBibTexTextarea.textContent = this.args.sourceBibTex;
    //     this.sourceBibTexTextarea.style.width = "100%";
    //     this.sourceBibTexTextarea.style.height = "16rem";

    //     // Reset button for Source BibTex
    //     const resetSourceButton = contentEl.createEl("button", { text: "Reset" });
    //     resetSourceButton.onclick = () => {
    //         this.sourceBibTexTextarea.value = this.args.sourceBibTex;
    //     };

    //     // Auto-update handler for Source BibTex
    //     this.sourceBibTexTextarea.oninput = () => {
    //         this.targetFilepathInput.value = computeTargetFilePath(
    //         	this.sourceBibTexTextarea.value,
				// this.referenceSubdirectoryRoot,
				// this.isSubdirectorizeReferencesLexically,
    //         );
			// this.normalizeDisplayedFilepathEnding()
    //     };

    //     // Target filepath section
    //     contentEl.createEl("h4", { text: "Reference filepath" });
    //     this.targetFilepathInput = contentEl.createEl("input", {
    //         type: "text",
    //         value: this.args.targetFilepath
    //     });
    //     this.targetFilepathInput.style.width = "100%"; // this needs to be css
		// this.normalizeDisplayedFilepathEnding()

		// // Add event listener for input changes
		// this.targetFilepathInput.addEventListener("input", () => {
			// this.normalizeDisplayedFilepathEnding()
		// });

    //     // Reset button for Target filepath
    //     const resetTargetPathButton = contentEl.createEl("button", { text: "Reset" });
    //     resetTargetPathButton.onclick = () => {
    //         this.targetFilepathInput.value = this.args.targetFilepath;
			// this.normalizeDisplayedFilepathEnding()
    //     };

    //     // Auto button for Target filepath
    //     const autoTargetPathButton = contentEl.createEl("button", { text: "Auto" });
    //     autoTargetPathButton.onclick = () => {
    //         this.targetFilepathInput.value = computeTargetFilePath(
    //         	this.sourceBibTexTextarea.value,
				// this.referenceSubdirectoryRoot,
				// this.isSubdirectorizeReferencesLexically,
    //         );
			// this.normalizeDisplayedFilepathEnding()
    //     };

    //     // Button container
    //     let buttonContainer = contentEl.createEl("div");
    //     buttonContainer.style.textAlign = "right";

    //     // Generate button
    //     const generateButton = buttonContainer.createEl("button", { text: "Generate" });
    //     generateButton.onclick = () => {
    //         this.args.onGenerate({
				// targetFilepath: this.targetFilepathInput.value.endsWith(".md")
    //                 ? this.targetFilepathInput.value
    //                 : this.targetFilepathInput.value + ".md",
    //             sourceBibTex: this.sourceBibTexTextarea.value
    //         });
    //         this.close();
    //     };

    //     // Cancel button
    //     const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
    //     cancelButton.onclick = () => {
    //         this.args.onCancel();
    //         this.close();
    //     };
    // }


    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

async function createOrOpenNote(
    app: App,
    filePath: string,
    isOpenNote: boolean = true,
    mode: PaneType | boolean = false,
): Promise<string> {

    const path = require('path');
    let notePath = path.join(filePath);
    if (!notePath.endsWith(".md")) {
    	notePath = notePath + ".md"
    }

    // Extract directory path from the file path
    const directoryPath = path.dirname(notePath);

    try {
        // Check if the directory exists, and create it if it doesn't
        if (!await app.vault.adapter.exists(directoryPath)) {
            await app.vault.createFolder(directoryPath);
        }

        // Check if the note exists
        const noteExists = await app.vault.adapter.exists(notePath);

        if (!noteExists) {
            // If the note does not exist, create it
            await app.vault.create(notePath, "");
        }
		if (isOpenNote) {
			app.workspace.openLinkText(notePath, '', mode);
		}
    } catch (error) {
        console.error('Error creating or opening the note:', error);
    }
    return notePath;
}


export function generateReferenceLibrary(
	app: App,
	bibFileData: string,
	referenceSourcePropertiesPrefix: string,
	referenceSubdirectoryRoot: string = "",
	isSubdirectorizeReferencesLexically: boolean = true,
	authorsParentFolderPath: string,
	isSubdirectorizeAuthorsLexically: boolean = true,
	isCreateAuthorPages: boolean = true,
) {
}

export function createReferenceNote(
	app: App,
	settings: BibliosidianSettings,
	defaultBibTex: string,
	targetFilepath: string,
    citeKey?: string,
	isOpenNote: boolean = true,
) {
	const bibtexModal = new BibTexModal(
		app,
		settings,
		(updatedArgs: BibTexModalArgs) => {
			generateReference(
				app,
				settings,
				updatedArgs,
				undefined,
			)
		},
		{
			sourceBibTex: defaultBibTex,
			targetFilepath: targetFilepath,
			isCreateAuthorPages: settings.isCreateAuthorPages, // settings gives default, args overrides
			isOpenNote: isOpenNote,
		},
	);
	bibtexModal.open();
}


export function createKeyValueTable<T extends Record<string, any>>(
    containerEl: HTMLElement,
    keyValueData: T
): HTMLTableElement {
    if (!keyValueData || typeof keyValueData !== 'object') {
        throw new Error('Invalid keyValueData provided.');
    }

    // Create the table element
    const table = document.createElement('table');
    table.style.width = '100%';
    table.setAttribute('border', '1');

    // Create the header row
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const headerCell1 = headerRow.insertCell();
    headerCell1.textContent = 'Property';
    const headerCell2 = headerRow.insertCell();
    headerCell2.textContent = 'Value';

    // Create the body of the table
    const tbody = table.createTBody();

    // Iterate over keyValueData and create rows
    for (const key in keyValueData) {
        if (keyValueData.hasOwnProperty(key)) {
            const row = tbody.insertRow();
            const cell1 = row.insertCell();
            cell1.textContent = key;
            const cell2 = row.insertCell();
            const value = keyValueData[key];

            // Handle different types of values
            cell2.textContent = (typeof value === 'object') ? JSON.stringify(value) : value;
        }
    }

    // Append the table to the container element
    containerEl.appendChild(table);

    // Return the table element
    return table;
}
