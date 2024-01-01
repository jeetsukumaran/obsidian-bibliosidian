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
	// Setting,
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
    onGenerate: (args: { targetFilepath: string, sourceBibTex: string }) => void;
    onCancel: () => void;
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
	targetFilepath: string,
    bibFileData: string,
    citeKey?: string,
) {

	let bibToYamlLabelFn: (arg0:string) => string = (bibStr) => `${settings.referenceSourcePropertiesPrefix}${bibStr}`

    let { bibEntry, bibtexStr, fieldValueMap } = getBibEntry(bibFileData, citeKey)

    if (!bibEntry) {
    	new Notice("Reference data could not be resolved")
    	return
    }

    let refProperties: FilePropertyData  = {}

	let citekey = bibEntry._id.toLowerCase()
    let authorLinks = generateAuthorLinks(
    	app,
		settings,
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
	let fileProperties = new FileProperties(this.app, targetFilepath)
	const updateDate = new Date();
	const updateDateStamp: string = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}-${String(updateDate.getDate()).padStart(2, '0')}T${String(updateDate.getHours()).padStart(2, '0')}:${String(updateDate.getMinutes()).padStart(2, '0')}:${String(updateDate.getSeconds()).padStart(2, '0')}`;

	// Add additional stuff
	// could try and merge with existing but right now, the additional m
	if (settings.referenceAdditionalMetadata) {
		refProperties = { ... refProperties, ... settings.referenceAdditionalMetadata }
	}

	let appendPropertyListItems = (propertyName: string, newItems: string[]) => {
		return [ ... fileProperties.readPropertyList(propertyName), ... newItems]
	}
	let addUniquePropertyListItems = (propertyName: string, newItems: string[], isSort: boolean = true) => {
		let result = Array.from(new Set([ ... fileProperties.readPropertyList(propertyName), ... newItems]))
		if (isSort) {
			result = result.sort()
		}
		return result
	}


	refProperties["entry-title"] = `**${inTextCitation}** ${compositeTitle}`
	// refProperties["entry-updated"] = updateDateStamp
	// refProperties["entry-updated"] = [ ... fileProperties.readPropertyList("entry-updated"), updateDateStamp]
	refProperties["entry-updated"] = appendPropertyListItems("entry-updated", [updateDateStamp])
	let authorBareLinks = authorLinks.map( (link) => link.bareLink )
	refProperties["entry-parents"] = addUniquePropertyListItems("entry-parents", authorBareLinks, true)

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

	refProperties["title"] = `${compositeTitle} (${inTextCitation})`
	if (abstract) {
		refProperties["abstract"] = abstract
	}
	refProperties["aliases"] = addUniquePropertyListItems(
		"aliases",
		[
			`@${citekey}`,
			inTextCitation,
			compositeTitle,
		],
	)

    updateFileProperties(
    	this.app,
    	targetFilepath,
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
            if (settings.isCreateAuthorPages) {
                let targetFilepath = authorFilePath;
                if (!targetFilepath.endsWith(".md")) {
					targetFilepath = targetFilepath + ".md"
                }
                createOrOpenNote(
                    app,
                    targetFilepath,
                    "",
                    false,
                    false,
                )
                .then( (result) => {
					let authorProperties: FilePropertyData = {};
					authorProperties["title"] = authorDisplayName;
					authorProperties["aliases"] = [authorDisplayName];
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
	targetFilepath: string,
	sourceBibTex: string,
	citeKey?: string,
	isOpenNote: boolean = false,
) {
	if (!targetFilepath || targetFilepath.startsWith(".") || targetFilepath === ".md") {
		return
	}
	createOrOpenNote(
		this.app,
		targetFilepath,
		"",
		isOpenNote,
		false,
	)
	.then( (result) => {
		generateSourceFrontmatter(
			app,
			settings,
			targetFilepath,
			sourceBibTex,
			citeKey,
		)
	})
	.catch( (error) => {} )
}

function computeTargetFilePath(
	sourceBibTex: string,
	referenceSubdirectoryRoot: string = "",
	isSubdirectorizeReferencesLexically: boolean = true,
): string {
	let bibEntry;
	let bibtexStr
	let fieldValueMap
	try {
		({ bibEntry, bibtexStr, fieldValueMap  } = getBibEntry(sourceBibTex))
	} catch (error) {
		// new Notice(`Reference data could not be resolved:\n${error}`)
		console.log(error)
	}
	// if (!bibEntry) {
	// 	new Notice("Reference data could not be resolved")
	// 	return
	// }
	if (!bibEntry) {
		return ""
	} else {
		return computeBibEntryTargetFilePath(
			bibEntry,
			referenceSubdirectoryRoot,
			isSubdirectorizeReferencesLexically
		)
	}
}

function computeBibEntryTargetFilePath(
	bibEntry: BibEntry,
	referenceSubdirectoryRoot: string = "",
	isSubdirectorizeReferencesLexically: boolean = true,
): string {
	let citekey = bibEntry._id
	let citekeyMarkedUp = `@${citekey}`
	let parentPath = referenceSubdirectoryRoot
	if (isSubdirectorizeReferencesLexically) {
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
    sourceBibTexTextarea: HTMLTextAreaElement;
    targetFilepathInput: HTMLInputElement;
	referenceSubdirectoryRoot: string;
	isSubdirectorizeReferencesLexically: boolean;

    constructor(
		app: App,
		referenceSubdirectoryRoot: string,
		isSubdirectorizeReferencesLexically: boolean,
		args: BibTexModalArgs,
    ) {
        super(app);
        this.args = args;
		this.referenceSubdirectoryRoot = referenceSubdirectoryRoot;
		this.isSubdirectorizeReferencesLexically = isSubdirectorizeReferencesLexically;
    }

    normalizeDisplayedFilepathEnding() {
		if (this.targetFilepathInput.value.endsWith(".md")) {
			this.targetFilepathInput.value = this.targetFilepathInput.value.slice(0, -3);
		}
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: "Reference data update" });

        // Source BibTex section
        contentEl.createEl("h4", { text: "Source BibTex" });
        this.sourceBibTexTextarea = contentEl.createEl("textarea");
        this.sourceBibTexTextarea.textContent = this.args.sourceBibTex;
        this.sourceBibTexTextarea.style.width = "100%";
        this.sourceBibTexTextarea.style.height = "16rem";

        // Reset button for Source BibTex
        const resetSourceButton = contentEl.createEl("button", { text: "Reset" });
        resetSourceButton.onclick = () => {
            this.sourceBibTexTextarea.value = this.args.sourceBibTex;
        };

        // Auto-update handler for Source BibTex
        this.sourceBibTexTextarea.oninput = () => {
            this.targetFilepathInput.value = computeTargetFilePath(
            	this.sourceBibTexTextarea.value,
				this.referenceSubdirectoryRoot,
				this.isSubdirectorizeReferencesLexically,
            );
			this.normalizeDisplayedFilepathEnding()
        };

        // Target filepath section
        contentEl.createEl("h4", { text: "Reference filepath" });
        this.targetFilepathInput = contentEl.createEl("input", {
            type: "text",
            value: this.args.targetFilepath
        });
        this.targetFilepathInput.style.width = "100%"; // this needs to be css
		this.normalizeDisplayedFilepathEnding()

		// Add event listener for input changes
		this.targetFilepathInput.addEventListener("input", () => {
			this.normalizeDisplayedFilepathEnding()
		});

        // Reset button for Target filepath
        const resetTargetPathButton = contentEl.createEl("button", { text: "Reset" });
        resetTargetPathButton.onclick = () => {
            this.targetFilepathInput.value = this.args.targetFilepath;
			this.normalizeDisplayedFilepathEnding()
        };

        // Auto button for Target filepath
        const autoTargetPathButton = contentEl.createEl("button", { text: "Auto" });
        autoTargetPathButton.onclick = () => {
            this.targetFilepathInput.value = computeTargetFilePath(
            	this.sourceBibTexTextarea.value,
				this.referenceSubdirectoryRoot,
				this.isSubdirectorizeReferencesLexically,
            );
			this.normalizeDisplayedFilepathEnding()
        };

        // Button container
        let buttonContainer = contentEl.createEl("div");
        buttonContainer.style.textAlign = "right";

        // Generate button
        const generateButton = buttonContainer.createEl("button", { text: "Generate" });
        generateButton.onclick = () => {
            this.args.onGenerate({
				targetFilepath: this.targetFilepathInput.value.endsWith(".md")
                    ? this.targetFilepathInput.value
                    : this.targetFilepathInput.value + ".md",
                sourceBibTex: this.sourceBibTexTextarea.value
            });
            this.close();
        };

        // Cancel button
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

async function createOrOpenNote(
    app: App,
    filePath: string,
    frontmatter: string = "",
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
            await app.vault.create(notePath, frontmatter);
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
	// const bibFile = parseBibFile(bibFileData);
	// Object.entries(bibFile.entries$).forEach(([key, value]: [string, BibEntry]) => {
	// 	let targetFilepath = computeBibEntryTargetFilePath(
	// 		value,
	// 		referenceSubdirectoryRoot,
	// 		isSubdirectorizeReferencesLexically
	// 	)
	// 	generateReference(
	// 		app,
	// 		targetFilepath,
	// 		bibFileData,
	// 		key,
	// 		referenceSourcePropertiesPrefix,
	// 		authorsParentFolderPath,
	// 		isSubdirectorizeReferencesLexically,
	// 		false,
	// 	)
	// });
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
		settings.referenceSubdirectoryRoot,
		settings.isSubdirectorizeReferencesLexically,
		{
		targetFilepath: targetFilepath,
		sourceBibTex: defaultBibTex,
		onGenerate: (args: BibTexModalArgs) => {
			generateReference(
				app,
				settings,
				args.targetFilepath,
				args.sourceBibTex,
				undefined,
				isOpenNote,
			)
		},
		onCancel: () => {
		}
	});
	bibtexModal.open();
}
