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
    onGenerate: (args: { targetFilepath: string, sourceBibTex: string }) => void;
    onCancel: () => void;
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

	let citekey = bibEntry._id.toLowerCase()
    let authorLinks = generateAuthorLinks(
    	app,
		settings,
		args,
		bibEntry,
		"author",
	)
	let authorLastNames: string[] = []
	const authorField = bibEntry.getField("author");
	(authorField as any).authors$.forEach((author: any) => {
		let lastName = author?.lastNames ? author.lastNames.join(" ") : ""
		if (lastName) {
			authorLastNames.push(lastName)
		}
	})

	let titleParts = [
		bibEntry.getFieldAsString("title"),
		bibEntry.getFieldAsString("subtitle"),
	].filter( (p) => p )
	let compositeTitle = titleParts.join(": ")

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
	let inTextCitation: string = `(${inTextCitationAuthors} ${inTextCitationYear})`

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

	refProperties["entry-title"] = `**${inTextCitation}** ${compositeTitle}`
	// refProperties["entry-updated"] = updateDateStamp
	// refProperties["entry-updated"] = [ ... fileProperties.readPropertyList("entry-updated"), updateDateStamp]
	// refProperties["entry-updated"] = appendPropertyListItems("entry-updated", [updateDateStamp])
	refProperties["entry-updated"] = fileProperties.concatItems("entry-updated", [updateDateStamp])
	let authorBareLinks = authorLinks.map( (link) => link.bareLink )
	refProperties["entry-parents"] = fileProperties.concatItems("entry-parents", authorBareLinks)

    refProperties[bibToYamlLabelFn("citekey")] = citekey
    refProperties[bibToYamlLabelFn("author")] = authorLinks.map( (link) => link.aliasedLink )
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

		// let fieldNames = [
		// 	"author",
		// 	"date",
		// 	"year",
		// 	"title",
		// 	"subtitle",
		// 	"journal",
		// 	"volume",
		// 	"number",
		// 	"pages",
		// 	"pagetotal",
		// 	"doi",
		// 	"isbn",
		// 	"url",
		// 	"publisher",
		// 	"booktitle",
		// 	"abstract",
		// 	"keywords",
		// 	"series",
		// 	"address",
		// 	"location",
		// 	"edition",
		// 	"chapter",
		// 	"note",
		// 	"institution",
		// 	"month",
		// 	"school",
		// 	"thesis",
		// 	"howpublished",
		// ]
		// fieldNames.forEach( (fieldName: string) => {
		// 	let entryValue = entry?.getFieldAsString(fieldName)
		// 	fieldValueMap[fieldName] = (entryValue && entryValue.toString()) || ""
		// 	if (entryValue !== undefined) {
		// 		bibtexStrParts.push(`  ${fieldName} = {${entryValue}},`)
		// 	}
		// })

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
	console.log(args)
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
	private _parsedBibEntry: BibEntry | undefined = undefined
	private _parsedBibTexStr: string = ""
	private _parsedFieldValueMap: { [key: string]: string } = {}

    constructor(
		app: App,
		settings: BibliosidianSettings,
		args: BibTexModalArgs,
    ) {
        super(app);
        this.settings = settings
        this.args = args;
    }

	buildParsedTextAreaComponent(
		containerEl: HTMLElement,
		initialValue: string = "",
		valuePlaceholder: string = "",
	) {
		let parsedInputSetting = new Setting(containerEl)
			.setName("Source")
			.setDesc("Source definition (BibTex)")
			// .setDesc(initialDescription)
		parsedInputSetting.addTextArea(text => {
			this.parsedSourceTextAreaComponent = text
			this.parsedSourceTextAreaComponent
				.setPlaceholder(valuePlaceholder)
				.setValue(initialValue);
			this.parsedSourceTextAreaComponent.inputEl.style.height = "12rem"
			// this.parsedSourceTextAreaComponent.inputEl.style.width = "100%"
			let parseUpdatedValue = () => {
				try {
					let inputValue: string = this.parsedSourceTextAreaComponent.getValue();
					parsedInputSetting.descEl.empty()
					if (inputValue) {
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
			.setName("Reference")
			.setDesc("Path to reference note")
		inputSetting.addTextArea(text => {
			this.referencePathTextComponent = text
			this.referencePathTextComponent.setValue(initialValue);
			this.referencePathTextComponent.inputEl.addEventListener("blur", async () => {
				// parseUpdatedValue()
			});
			this.referencePathTextComponent.inputEl.style.width = "100%"
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

		// this sets up referenceSourceBibTexComponent
		// contentEl.createEl("h2", { text: "Source" })
		let referenceSourceBibTexComponent = this.buildParsedTextAreaComponent(
			contentEl,
			this.args.sourceBibTex,
		)

		// contentEl.createEl("h2", { text: "Reference" })
		this.renderReferenceLocationInputTextArea(
			contentEl,
			this.args.targetFilepath,
		)

		// contentEl.createEl("h2", { text: "Authors" })
		let updateAuthorsSettings = new Setting(contentEl)
		updateAuthorsSettings
			.setName("Authors")
			.setDesc("Update associated source author notes")
		updateAuthorsSettings.addToggle( toggle => {
			toggle
				.setValue(this.args.isCreateAuthorPages)
				.onChange(async (value) => {
					this.args.isCreateAuthorPages = value;
				})
		})

		// contentEl.createEl("h2", { text: "Update" })
		let execute = () => {
			this.args.targetFilepath = this.referencePathTextComponent.getValue().endsWith(".md") ? this.referencePathTextComponent.getValue() : this.referencePathTextComponent.getValue() + ".md"
			this.args.sourceBibTex = this.parsedSourceTextAreaComponent.getValue()
			this.args.onGenerate(this.args);
			this.close();
		}
		let runUpdate = new Setting(contentEl)
		runUpdate
			.addButton( (button: ButtonComponent) => {
				button
				.setButtonText("Update")
				.onClick( () => {
					this.args.isOpenNote = false
					execute()
				});
			})
			.addButton( (button: ButtonComponent) => {
				button
				.setButtonText("Update and Open")
				.onClick( () => {
					this.args.isOpenNote = true
					execute()
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
		{
		sourceBibTex: defaultBibTex,
		targetFilepath: targetFilepath,
		isCreateAuthorPages: settings.isCreateAuthorPages, // settings gives default, args overrides
		onGenerate: (updatedArgs: BibTexModalArgs) => {
			generateReference(
				app,
				settings,
				updatedArgs,
				undefined,
			)
		},
		onCancel: () => {
		},
		isOpenNote: isOpenNote,
	});
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
