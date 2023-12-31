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
	FieldValue,
} from "bibtex";

import {
	FilePropertyData,
	updateFileProperties,
	// updateFrontmatterYaml,
} from "./fileProperties"


// import { parseBibFile } from "bibtex";
import * as _path from "path";


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
                             ) || "author-file";

    return {
        displayName: displayNameParts.join(", "),
        normalizedFileName: normalizedFileName,
    }
}

function generateSourceFrontmatter(
	app: App,
	targetFilepath: string,
    bibFileData: string,
    citeKey?: string,
    fieldNamePrefix:string = "",
    authorsParentFolderPath: string = "",
) {

	// let targetFile = app.vault.getAbstractFileByPath(targetFilepath)
	// if (!targetFile) {
	// 	return
	// }

	let bibToYamlLabelFn: (arg0:string) => string = (bibStr) => `${fieldNamePrefix}${bibStr}`

    let { bibEntry, bibtexStr, fieldValueMap } = getBibEntry(bibFileData, citeKey)

    if (!bibEntry) {
    	new Notice("Reference data could not be resolved")
    	return
    }
    let refProperties: FilePropertyData  = {}
	let citekey = bibEntry._id.toLowerCase()
    refProperties[bibToYamlLabelFn("citekey")] = citekey
    refProperties[bibToYamlLabelFn("author")] = generateAuthorLinks(
		bibEntry,
		"author",
		authorsParentFolderPath,
	)

    // refProperties[bibToYamlLabelFn("editor")] = generateAuthorLinks(
		// bibEntry,
		// "editor",
		// authorsParentFolderPath,
	// )

    refProperties[bibToYamlLabelFn("date")] = normalizeFieldValue( bibEntry.getField("date") ) || normalizeFieldValue( bibEntry.getField("year") )

	let titleParts = [
		bibEntry.getFieldAsString("title"),
		bibEntry.getFieldAsString("subtitle"),
	].filter( (p) => p )
	let compositeTitle = titleParts.join(": ")
    refProperties[bibToYamlLabelFn("title")] = compositeTitle

    // refProperties[bibToYamlLabelFn("journal")] = normalizeFieldValue( bibEntry.getField("journal") )
	// refProperties[bibToYamlLabelFn("volume")] = normalizeFieldValue( bibEntry.getField("volume") )
	// refProperties[bibToYamlLabelFn("number")] = normalizeFieldValue( bibEntry.getField("number") )
	// refProperties[bibToYamlLabelFn("pages")] = normalizeFieldValue( bibEntry.getField("pages") )
	// refProperties[bibToYamlLabelFn("doi")] = normalizeFieldValue( bibEntry.getField("doi") )
	// refProperties[bibToYamlLabelFn("url")] = normalizeFieldValue( bibEntry.getField("url") )
	// refProperties[bibToYamlLabelFn("publisher")] = normalizeFieldValue( bibEntry.getField("publisher") )
	// refProperties[bibToYamlLabelFn("booktitle")] = normalizeFieldValue( bibEntry.getField("booktitle") )
    // refProperties[bibToYamlLabelFn("editor")] = normalizeFieldValue( bibEntry.getField("editor") )
	// refProperties[bibToYamlLabelFn("abstract")] = normalizeFieldValue( bibEntry.getField("abstract") )
	// refProperties[bibToYamlLabelFn("keywords")] = normalizeFieldValue( bibEntry.getField("keywords") )
	// refProperties[bibToYamlLabelFn("series")] = normalizeFieldValue( bibEntry.getField("series") )
	// refProperties[bibToYamlLabelFn("address")] = normalizeFieldValue( bibEntry.getField("address") )
	// refProperties[bibToYamlLabelFn("edition")] = normalizeFieldValue( bibEntry.getField("edition") )
	// refProperties[bibToYamlLabelFn("chapter")] = normalizeFieldValue( bibEntry.getField("chapter") )
	// refProperties[bibToYamlLabelFn("note")] = normalizeFieldValue( bibEntry.getField("note") )
	// refProperties[bibToYamlLabelFn("institution")] = normalizeFieldValue( bibEntry.getField("institution") )
	// refProperties[bibToYamlLabelFn("month")] = normalizeFieldValue( bibEntry.getField("month") )
	// refProperties[bibToYamlLabelFn("school")] = normalizeFieldValue( bibEntry.getField("school") )
	// refProperties[bibToYamlLabelFn("thesis")] = normalizeFieldValue( bibEntry.getField("thesis") )
	// refProperties[bibToYamlLabelFn("howpublished")] = normalizeFieldValue( bibEntry.getField("howpublished") )
	refProperties[bibToYamlLabelFn("journal")] = bibEntry.getFieldAsString("journal")
	refProperties[bibToYamlLabelFn("volume")] = bibEntry.getFieldAsString("volume")
	refProperties[bibToYamlLabelFn("number")] = bibEntry.getFieldAsString("number")
	refProperties[bibToYamlLabelFn("pages")] = bibEntry.getFieldAsString("pages")
	refProperties[bibToYamlLabelFn("doi")] = bibEntry.getFieldAsString("doi")
	refProperties[bibToYamlLabelFn("url")] = bibEntry.getFieldAsString("url")
	refProperties[bibToYamlLabelFn("publisher")] = bibEntry.getFieldAsString("publisher")
	refProperties[bibToYamlLabelFn("booktitle")] = bibEntry.getFieldAsString("booktitle")
	refProperties[bibToYamlLabelFn("editor")] = bibEntry.getFieldAsString("editor")
	refProperties[bibToYamlLabelFn("abstract")] = bibEntry.getFieldAsString("abstract")
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

	/* Special fields */
    if (true) {
	}

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
		bibtexStrParts.push(`@${entry.type}{${entry._id},`)
		let fieldNames = [
			"author",
			"date",
			"title",
			"subtitle",
			"journal",
			"volume",
			"number",
			"pages",
			"pagetotal",
			"doi",
			"isbn",
			"url",
			"publisher",
			"booktitle",
			"abstract",
			"keywords",
			"series",
			"address",
			"location",
			"edition",
			"chapter",
			"note",
			"institution",
			"month",
			"school",
			"thesis",
			"howpublished",
		]
		fieldNames.forEach( (fieldName: string) => {
			let entryValue = entry?.getFieldAsString(fieldName)
			fieldValueMap[fieldName] = (entryValue && entryValue.toString()) || ""
			if (entryValue !== undefined) {
				bibtexStrParts.push(`  ${fieldName} = {${entryValue}},`)
			}
		})
		bibtexStrParts.push("}")
	}
	return {
		bibEntry: entry,
		bibtexStr: bibtexStrParts.join("\n"),
		fieldValueMap: fieldValueMap,
	}
}

function generateAuthorLinks(
	entry: BibEntry,
	authorFieldName: string = "author",
    parentFolderPath: string = "",
): string[] {
    let results: string[] = [];
    if (!entry) {
        return results;
    }
	if (authorFieldName === "author") {
		const authorField = entry.getField(authorFieldName);
        results = (authorField as any).authors$.map((author: any) => {
            const {
            	displayName: authorDisplayName,
            	normalizedFileName: authorFileName,
            } = composeAuthorData(author)
            const authorFilePath = _path.join(parentFolderPath, authorFileName);

            return `[[${authorFilePath}|${authorDisplayName}]]`;
        });
	}
    return results;
}



function generateReference(
	app: App,
	targetFilepath: string,
	sourceBibTex: string,
	citeKey?: string,
	fieldNamePrefix: string = "",
	authorsParentFolderPath: string = "",
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
			targetFilepath,
			sourceBibTex,
			citeKey,
			fieldNamePrefix,
			authorsParentFolderPath,
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
    console.log(notePath)
}


export function generateReferenceLibrary(
	app: App,
	bibFileData: string,
	fieldNamePrefix: string,
	referenceSubdirectoryRoot: string = "",
	isSubdirectorizeReferencesLexically: boolean = true,
	authorsParentFolderPath: string,
) {
	const bibFile = parseBibFile(bibFileData);
	Object.entries(bibFile.entries$).forEach(([key, value]: [string, BibEntry]) => {
		let targetFilepath = computeBibEntryTargetFilePath(
			value,
			referenceSubdirectoryRoot,
			isSubdirectorizeReferencesLexically
		)
		generateReference(
			app,
			targetFilepath,
			bibFileData,
			key,
			fieldNamePrefix,
			authorsParentFolderPath,
			false,
		)
	});
}

export function createReferenceNote(
	app: App,
	defaultBibTex: string,
	targetFilepath: string,
    citeKey?: string,
    fieldNamePrefix: string = "",
	referenceSubdirectoryRoot: string = "",
	isSubdirectorizeReferencesLexically: boolean = true,
    authorsParentFolderPath: string = "",
) {
	const bibtexModal = new BibTexModal(
		app,
		referenceSubdirectoryRoot,
		isSubdirectorizeReferencesLexically,
		{
		targetFilepath: targetFilepath,
		sourceBibTex: defaultBibTex,
		onGenerate: (args: BibTexModalArgs) => {
			generateReference(
				app,
				args.targetFilepath,
				args.sourceBibTex,
				undefined,
				fieldNamePrefix,
				authorsParentFolderPath,
				true,
			)
		},
		onCancel: () => {
			// console.log('Cancel clicked');
		}
	});
	bibtexModal.open();
}
