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

export function generateSourceFrontmatter(
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

    let bibEntry = getBibEntry(bibFileData, citeKey)

    if (!bibEntry) {
    	new Notice("Reference data could not be resolved")
    	return
    }
    let refProperties: FilePropertyData  = {}
    refProperties[bibToYamlLabelFn("citekey")] = bibEntry._id.toLowerCase()
    refProperties[bibToYamlLabelFn("author")] = generateAuthorLinks(
		bibEntry,
		authorsParentFolderPath,
	)
    refProperties[bibToYamlLabelFn("year")] = normalizeFieldValue( bibEntry.getField("year") )
    refProperties[bibToYamlLabelFn("date")] = normalizeFieldValue( bibEntry.getField("date") ) || normalizeFieldValue( bibEntry.getField("year") )
    refProperties[bibToYamlLabelFn("title")] = normalizeFieldValue( bibEntry.getField("title") )




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
): BibEntry | undefined {
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
	return entry
}

function generateAuthorLinks(
	entry: BibEntry,
    parentFolderPath: string = "",
): string[] {
    let results: string[] = [];
    if (!entry) {
        return results;
    }
    const authorField = entry.getField("author");
    if (authorField && typeof authorField === 'object' && 'authors$' in authorField) {
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
			createOrOpenNote(
				this.app,
				args.targetFilepath,
				undefined,
			)
			.then( (result) => {
				generateSourceFrontmatter(
					this.app,
					args.targetFilepath,
					args.sourceBibTex,
					undefined,
					fieldNamePrefix,
					authorsParentFolderPath,
				)
			})
			.catch( (error) => {} )
		},
		onCancel: () => {
			// console.log('Cancel clicked');
		}
	});
	bibtexModal.open();
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

    computeTargetFilePath(sourceBibTex: string): string {
        // Implement logic to compute target file path based on source BibTex
        // Return the computed string
		let bibEntry: BibEntry | undefined;
		try {
			bibEntry = getBibEntry(sourceBibTex)
		} catch (error) {
		}
		if (!bibEntry) {
			return ""
		} else {
			return _path.join(this.referenceSubdirectoryRoot, `@${bibEntry._id.toLowerCase()}`)
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
            this.targetFilepathInput.value = this.computeTargetFilePath(this.sourceBibTexTextarea.value);
        };

        // Target filepath section
        contentEl.createEl("h4", { text: "Reference filepath" });
        this.targetFilepathInput = contentEl.createEl("input", {
            type: "text",
            value: this.args.targetFilepath
        });
        this.targetFilepathInput.style.width = "100%"; // this needs to be css

		// Add event listener for input changes
		this.targetFilepathInput.addEventListener("input", () => {
			if (this.targetFilepathInput.value.endsWith(".md")) {
				this.targetFilepathInput.value = this.targetFilepathInput.value.slice(0, -3);
			}
		});

        // Reset button for Target filepath
        const resetTargetPathButton = contentEl.createEl("button", { text: "Reset" });
        resetTargetPathButton.onclick = () => {
            this.targetFilepathInput.value = this.args.targetFilepath;
        };

        // Auto button for Target filepath
        const autoTargetPathButton = contentEl.createEl("button", { text: "Auto" });
        autoTargetPathButton.onclick = () => {
            this.targetFilepathInput.value = this.computeTargetFilePath(this.sourceBibTexTextarea.value);
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
    mode: PaneType | undefined = undefined,
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

        // Open the note in the specified mode
        app.workspace.openLinkText(notePath, '', mode);
    } catch (error) {
        console.error('Error creating or opening the note:', error);
    }
    return notePath;
    console.log(notePath)
}

