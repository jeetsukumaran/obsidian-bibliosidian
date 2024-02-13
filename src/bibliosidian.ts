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
	Authors,
	parseBibFile,
	normalizeFieldValue,
	BibEntry,
	EntryFields,
	FieldValue,
	parseAuthorName,
} from "bibtex";

import {
	FileProperties,
	FilePropertyData,
	updateFileProperties,
	// updateFrontmatterYaml,
} from "./fileProperties";

import {
    createOrOpenNote,
} from "./utility";

import {
    BibliosidianSettings,
} from "./settings";

// import { parseBibFile } from "bibtex";
import * as _path from "path";

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

	let bibToYamlLabelFn: (arg0:string) => string = (bibStr) => `${settings.biblioNoteSourcePropertiesPrefix}${bibStr}`

    let { bibEntry, bibtexStr, fieldValueMap } = getBibEntry(args.sourceBibTex, citeKey)

    if (!bibEntry) {
    	new Notice("BiblioNote data could not be resolved")
    	return
    }

    let refProperties: FilePropertyData  = {}

	let citationKey = bibEntry._id.toLowerCase();
	let authorLastNames: string[] = [];
	// let auFieldNames: string[] = [
	//     "author",
    	// "editor",
    // ];
    // auFieldNames.forEach( (auFieldName) => {
    let creatorNames: { [key: string]: Authors } = {};
    for (let creatorTypeName of ["author", "editor"]) {
        let fieldValue: FieldValue = bibEntry?.fields[creatorTypeName] as FieldValue
        if (!fieldValue) {
            continue;
        }
        let authors: Authors;
        try {
            authors = new Authors(fieldValue);
        } catch(error) {
            console.log(error);
            continue;
        }
        creatorNames[creatorTypeName] = authors;
        try {
            authors.authors$?.forEach((author: any) => {
                let lastName = author?.lastNames ? author.lastNames.join(" ") : ""
                // console.log(lastName);
                if (lastName) {
                    authorLastNames.push(lastName);
                }
            });
        } catch (error) {
            console.log(error);
        }

    };

    // let creators: Authors[] = [];
	// let auFieldNames = [
	    // "author",
    // 	"editor",
    // ];
    // auFieldNames.forEach( (auFieldName) => {
    //     let fieldValue: FieldValue = bibEntry?.fields[auFieldName] as FieldValue
    //     if (!fieldValue) {
    //         return;
    //     }
    //     let authors: Authors;
    //     try {
    //          authors = new Authors(fieldValue);
    //     } catch(error) {
    //         console.log(error);
    //         return;
    //     }
    //     creators.push(authors);
    //     try {
    //         authors.authors$?.forEach((author: any) => {
    //             let lastName = author?.lastNames ? author.lastNames.join(" ") : ""
    //             console.log(lastName);
    //             if (lastName) {
    //                 authorLastNames.push(lastName);
    //             }
    //         });
    //     } catch (error) {
    //         console.log(error);
    //     }
    // });

    let cleanSingleLine = (s: string | undefined): string => {
        if (s) {
            return s.replace(/\s+/g, " ")
        } else {
            return ""
        }
    }

	let bibTitle = bibEntry.title$ || cleanSingleLine(bibEntry.getFieldAsString("title")?.toString())
	let titleParts = [
		cleanSingleLine(bibTitle),
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
	if (settings.biblioNoteAdditionalMetadata) {
		refProperties = { ... refProperties, ... settings.biblioNoteAdditionalMetadata }
	}


	let entryTitle = `${inTextCitation} *${compositeTitle}*`
	refProperties["entry-title"] = entryTitle

    refProperties["entry-parents"] = []
	refProperties["entry-updated"] = fileProperties.concatItems("entry-updated", [updateDateStamp])
    refProperties[bibToYamlLabelFn("citekey")] = citationKey

    Object.entries(creatorNames).forEach(([key, value]) => {
        if (!bibEntry) {
            return;
        }
        let authorLinks = generateAuthorLinks(
            app,
            settings,
            args,
            bibEntry,
            `${inTextCitation} ${compositeTitle}`,
            [value],
        )
        let authorBareLinks = authorLinks.map( (link) => link.bareLink );
        if (!key.endsWith("s")) {
            key = key + "s" // authors not author
        }
        let refKey: string = bibToYamlLabelFn(key);
        refProperties[refKey] = authorLinks.map( (link) => link.aliasedLink );
        // refProperties["entry-parents"].push(... fileProperties.concatItems("entry-parents", authorBareLinks))
    })


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
	// let entryTitle = `(@${citationKey}) ${compositeTitle}`

	refProperties["title"] = `${compositeTitle} ${inTextCitation}`
	if (abstract) {
		refProperties["abstract"] = abstract
	}
	refProperties["aliases"] = fileProperties.concatItems(
		"aliases",
		[
			`@${citationKey}`,
			inTextCitation,
			compositeTitle,
			entryTitle,
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
    bibFileData = bibFileData.replace(/month\s*=\s*([a-zA-Z0-9]+)\s*,/g,"month = {$1},");
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
    creatorSets: Authors[],
): { bareLink: string; aliasedLink: string; }[] {
    let results: { bareLink: string; aliasedLink: string; }[] = [];
    if (!entry) {
        return results;
    }
    creatorSets.forEach( (creator: Authors) => {
        let authorLastNames: string[] = []
		const updateDate = new Date();
		const updateDateStamp: string = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}-${String(updateDate.getDate()).padStart(2, '0')}T${String(updateDate.getHours()).padStart(2, '0')}:${String(updateDate.getMinutes()).padStart(2, '0')}:${String(updateDate.getSeconds()).padStart(2, '0')}`;
        // const authorField = entry.getField(authorFieldName);
        results = creator.authors$.map((author: any) => {
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
					authorProperties["aliases"] = fileProperties.concatItems( "aliases", [ authorDisplayName, ],);
					let sourceLink = `[[${args.targetFilepath}|${entryTitle}]]`
                    let refPropName = settings.authorBiblioNoteOutlinkPropertyName || "biblioNotes";
					authorProperties[refPropName] = fileProperties
						.concatItems(refPropName, [sourceLink]);
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
    });
    return results;
}


function generateBiblioNote(
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
	let citationKey = bibEntry._id
	let citekeyMarkedUp = `@${citationKey}`
	let parentPath = settings.biblioNoteSubdirectoryRoot
	if (settings.isSubdirectorizeBiblioNotesLexically) {
		parentPath = _path.join(parentPath, replaceProblematicChars(citationKey[0]))
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
	parsedSourceTextAreaComponent: HTMLTextAreaElement;
	biblioNotePathTextComponent: HTMLTextAreaElement;
	isEnableBiblioNotePathAutoUpdate: boolean = true
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
        let valuePlaceholder = (
`@article{kullback1951,
  title={On information and sufficiency},
  author={Kullback, Solomon and Leibler, Richard A},
  journal={The annals of mathematical statistics},
  volume={22},
  number={1},
  pages={79--86},
  year={1951},
}`
            )
        // containerEl.createEl("h3", { text: "BiblioNote BibTeX" })
        this.parsedSourceTextAreaComponent = containerEl.createEl("textarea");
        this.parsedSourceTextAreaComponent.placeholder = valuePlaceholder;
        this.parsedSourceTextAreaComponent.style.width = "100%";
        this.parsedSourceTextAreaComponent.style.height = "12rem";

        // containerEl.createEl("h3", { text: "BiblioNote data" })
        containerEl.createEl("br");
        let descEl = containerEl.createEl("div");
        descEl.style.width = "100%";
        descEl.style.marginBottom = "0.5rem";
        // descEl.style.height = "8rem";
        // descEl.style.border = "solid 1px";

        let parseUpdatedValue = () => {
            try {
                let inputValue: string = this.parsedSourceTextAreaComponent.value;
                descEl.empty()
                if (inputValue) {
                    // as of 2024-01-16, the parser doesn't handle `month = feb`,
                    // and lots of sources emit this
                    let result = getBibEntry(inputValue)
                    this._parsedBibEntry = result.bibEntry
                    this._parsedBibTexStr = result.bibtexStr
                    this._parsedFieldValueMap = result.fieldValueMap
                    createKeyValueTable(descEl, this._parsedFieldValueMap)
                    if (this.isEnableBiblioNotePathAutoUpdate) {
                        this.setBiblioNotePathTextComponentFromSource()
                    }
                } else {
                    this._parsedBibEntry = undefined
                    this._parsedBibTexStr = ""
                    this._parsedFieldValueMap = {}
                }
                // createFilePropertyDataTable(refPropertiesSetting.descEl, refProperties)
            } catch (error) {
                console.log(error);
                let messageStr = "Parse error: " + error.message;
                let messageNode = document.createTextNode(messageStr);
                descEl.empty()
                descEl.appendChild(messageNode);
            }
        }
        parseUpdatedValue()
        this.parsedSourceTextAreaComponent.addEventListener("blur", async () => {
            parseUpdatedValue()
        });

        let toolPanel = containerEl.createEl("div", { cls: ["model-input-support-panel"] })
        toolPanel.style.width = "100%";
        // toolPanel.style.textAlign = "left";
        let panelSetting = new Setting(toolPanel)
        panelSetting.controlEl.style.width = "100%";
        // panelSetting.controlEl.style.textAlign = "left";
        let resetButton = panelSetting.addButton( (button: ButtonComponent) => {
            button
            .setButtonText("Reset")
            .onClick( () => {
                this.parsedSourceTextAreaComponent.value = initialValue;
                parseUpdatedValue()
            });
        });


	}

	setBiblioNotePathTextComponentFromSource() {
		if (this._parsedBibEntry) {
			let filePath = computeBibEntryTargetFilePath(
				this._parsedBibEntry,
				this.settings,
			)
			this.biblioNotePathTextComponent.value = filePath;
		} else {
		}
	}

	renderBiblioNoteLocationInputTextArea(
		containerEl: HTMLElement,
		initialValue: string = "",
	) {
		// let inputSetting = new Setting(containerEl)
		// 	.setName("BiblioNote note path")
		// 	.setDesc("Path to file in folder where this biblioNote will be stored.")
		// inputSetting.addTextArea(text => {
		// 	this.biblioNotePathTextComponent = text
		// 	this.biblioNotePathTextComponent.setValue(initialValue);
		// 	this.biblioNotePathTextComponent.inputEl.addEventListener("blur", async () => {
		// 		// parseUpdatedValue()
		// 	});
		// 	this.biblioNotePathTextComponent.inputEl.style.height = "4rem"
		// 	this.biblioNotePathTextComponent.inputEl.style.overflow = "scroll"
		// });


        this.biblioNotePathTextComponent = containerEl.createEl("textarea");
        this.biblioNotePathTextComponent.style.width = "100%";
        this.biblioNotePathTextComponent.style.height = "2rem";

		let toolPanel = containerEl.createEl("div", { cls: ["model-input-support-panel"] })
		let panelSetting = new Setting(toolPanel)

        panelSetting.controlEl.appendChild(document.createTextNode("Set from BibTeX"));
		panelSetting.addToggle( toggle => {
			toggle
				.setValue(this.isEnableBiblioNotePathAutoUpdate)
				.onChange(async (value) => {
					this.isEnableBiblioNotePathAutoUpdate = value;
				})
		});

        // panelSetting.controlEl.appendChild(document.createTextNode("Update authors"));
        // panelSetting.addToggle( toggle => {
        //     toggle
        //     .setValue(this.args.isCreateAuthorPages)
        //     .onChange(async (value) => {
        //         this.args.isCreateAuthorPages = value;
        //     })
        // });

		panelSetting.addButton( (button: ButtonComponent) => {
			button
			.setButtonText("Auto")
			.onClick( () => {
				this.setBiblioNotePathTextComponentFromSource()
			});
		});
		panelSetting.addButton( (button: ButtonComponent) => {
			button
			.setButtonText("Reset")
			.onClick( () => {
				this.biblioNotePathTextComponent.value = initialValue;
			});
		});
	}

    onOpen() {
        const { contentEl } = this;
		contentEl.createEl("h1", { text: "Create or update a bibliographic note" })

		contentEl.createEl("h2", { text: "Source BibTeX" });
		let biblioNoteSourceBibTexComponent = this.buildParsedTextAreaComponent(
			contentEl,
			this.args.sourceBibTex,
		);

		contentEl.createEl("h2", { text: "Destination bibliographic note path" })
		this.renderBiblioNoteLocationInputTextArea(
			contentEl,
			this.args.targetFilepath,
		);

		contentEl.createEl("h2", { text: "Author note(s)" })
		let updateAuthorsSettings = new Setting(contentEl)
		updateAuthorsSettings
			.setName("Update source author notes")
			.setDesc("Create or update notes for each author, adding links to bibliographic note and vice versa.")
			// .setDesc("Create or update biblioNote and associated author notes.")
		updateAuthorsSettings.addToggle( toggle => {
			toggle
				.setValue(this.args.isCreateAuthorPages)
				.onChange(async (value) => {
					this.args.isCreateAuthorPages = value;
				})
		})

		let execute = (isQuiet: boolean = true, isCopyLink = false) => {
			this.args.targetFilepath = this.biblioNotePathTextComponent.value.endsWith(".md") ? this.biblioNotePathTextComponent.value : this.biblioNotePathTextComponent.value + ".md"
			if (isCopyLink) {
                let basenameWithoutExtension: string = _path.basename(this.args.targetFilepath, ".md");
                let clipText = `[[${basenameWithoutExtension}]]`;
                navigator.clipboard.writeText(clipText);
                // let basenameWithoutExtension: string = ....
                // let clipText = `[[${basenameWithoutExtension}]]`;
                // ... copy clipTextToClipboard
			}
			this.args.sourceBibTex = this.parsedSourceTextAreaComponent.value;
			this.onGenerate(this.args);
			if (!isQuiet) {
				new Notice(`BiblioNote updated: '${this.args.targetFilepath}' `)
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
					execute(false, true)
				});
			})
			.addButton( (button: ButtonComponent) => {
				button
				.setButtonText("Update and open")
				.onClick( () => {
					this.args.isOpenNote = true
					execute(true, true)
				});
			})
			.addButton( (button: ButtonComponent) => {
				button
				.setButtonText("Update and copy citation")
				.onClick( () => {
					this.args.isOpenNote = false
					execute(false, true)
				});
			})
			;


    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}



export function generateBiblioNoteLibrary(
	app: App,
	bibFileData: string,
	biblioNoteSourcePropertiesPrefix: string,
	biblioNoteSubdirectoryRoot: string = "",
	isSubdirectorizeBiblioNotesLexically: boolean = true,
	authorsParentFolderPath: string,
	isSubdirectorizeAuthorsLexically: boolean = true,
	isCreateAuthorPages: boolean = true,
) {
}

export function createBiblioNote(
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
			generateBiblioNote(
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
