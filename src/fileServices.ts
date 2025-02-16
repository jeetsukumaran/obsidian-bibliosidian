
import {
    TFile,
    FileSystemAdapter,
    ButtonComponent,
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
import * as fs from 'fs';
import { promisify } from 'util';

import {
    BibliosidianConfiguration,
    NoteConfiguration,
} from "./settings";

import {
    ensureDirectoryExists,
    ensureUniquePath,
    ensureStringArray,
    createOrOpenNote,
    composeNoteLocation,
    createUniqueNote,
} from "./utility";

import {
    readPropertyDict,
	getMetadataCache,
	FileProperties,
	FilePropertyData,
	updateFrontMatter,
} from "./fileProperties";


const copyFile = promisify(fs.copyFile);
const fileExists = promisify(fs.access);

export type ConflictResolution = {
    action: 'skip' | 'replace' | 'disambiguate';
    applyToAll: boolean;
}

export class FileConflictModal extends Modal {
    private resolution: ConflictResolution | null = null;
    private onResolve: (resolution: ConflictResolution) => void;
    private filePath: string;

    constructor(app: App, filePath: string, onResolve: (resolution: ConflictResolution) => void) {
        super(app);
        this.filePath = filePath;
        this.onResolve = onResolve;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'File Conflict' });
        contentEl.createEl('p', { text: `File already exists at path:` });
        // contentEl.createEl('br');
        // contentEl.createEl('p', { text: `${this.filePath}` });
        // contentEl.createEl('br');
        const existingPathArea = contentEl.createEl('textarea', {
            text: this.filePath
        });
        existingPathArea.setAttr('readonly', 'true');
        existingPathArea.style.width = '100%';
        existingPathArea.style.height = '3em';
        existingPathArea.style.marginBottom = '1em';
        contentEl.createEl('p', { text: 'Would you like to replace this?' });


        // Individual actions
        new Setting(contentEl)
            .setName('Skip')
            .setDesc('Skip importing this file')
            .addButton((btn) =>
                btn
                    .setButtonText('Skip')
                    .onClick(() => {
                        this.resolveAndClose({ action: 'skip', applyToAll: false });
                    })
            );

        new Setting(contentEl)
            .setName('Replace')
            .setDesc('Replace existing file')
            .addButton((btn) =>
                btn
                    .setButtonText('Replace')
                    .onClick(() => {
                        this.resolveAndClose({ action: 'replace', applyToAll: false });
                    })
            );

        new Setting(contentEl)
            .setName('Rename')
            .setDesc('Automatically rename to avoid conflict')
            .addButton((btn) =>
                btn
                    .setButtonText('Rename')
                    .setCta()
                    .onClick(() => {
                        this.resolveAndClose({ action: 'disambiguate', applyToAll: false });
                    })
            );

        new Setting(contentEl)
            .setName('Apply to all conflicts')
            .setDesc('Choose an action to apply to all remaining conflicts')
            .addButton((btn) =>
                btn
                    .setButtonText('Skip All')
                    .onClick(() => {
                        this.resolveAndClose({ action: 'skip', applyToAll: true });
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText('Replace All')
                    .onClick(() => {
                        this.resolveAndClose({ action: 'replace', applyToAll: true });
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText('Rename All')
                    .setCta()
                    .onClick(() => {
                        this.resolveAndClose({ action: 'disambiguate', applyToAll: true });
                    })
            );

    }

    private resolveAndClose(resolution: ConflictResolution) {
        this.resolution = resolution;
        this.onResolve(resolution);
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (!this.resolution) {
            // If modal was closed without selection, default to skip
            this.onResolve({ action: 'skip', applyToAll: false });
        }
    }
}

interface ImportResult {
    success: boolean;
    destinationPath: string;
    error?: string;
}

let globalResolution: ConflictResolution | null = null;

export async function importHolding(
    app: App,
    configuration: BibliosidianConfiguration,
    hostFilePath: string,
    sourceFilePath: string,
    importConflict: 'prompt-user' | 'skip' | 'replace' | 'disambiguate' = 'prompt-user',
    isSilent: boolean = false // Controls detailed feedback
): Promise<ImportResult> {
    try {
        if (!hostFilePath || !sourceFilePath) {
            return { success: false, destinationPath: '', error: 'Host or source file path is empty' };
        }

        try {
            await fileExists(sourceFilePath);
        } catch {
            return { success: false, destinationPath: '', error: `Source file does not exist: ${sourceFilePath}` };
        }

        const hostFile = app.vault.getAbstractFileByPath(hostFilePath);
        if (!(hostFile instanceof TFile)) {
            return { success: false, destinationPath: '', error: 'Host file not found or not a valid file' };
        }

        let parentPath = configuration.holdingsParentFolder;
        const destExtension = _path.extname(sourceFilePath);
        let destinationFilename = _path.basename(hostFile.path, _path.extname(hostFile.path)).replace(/^@/,"") + destExtension;

        if (configuration.biblioNoteConfiguration.isSubdirectorizeLexically) {
            const subDir = destinationFilename[0] === "@" ? destinationFilename[1] : destinationFilename[0];
            parentPath = _path.join(parentPath, subDir);
        }

        let destinationPath = _path.join(parentPath, destinationFilename);
        await ensureDirectoryExists(app, _path.dirname(destinationPath));

        const adapter = app.vault.adapter;
        if (!(adapter instanceof FileSystemAdapter)) {
            return { success: false, destinationPath: '', error: 'Could not access vault file system' };
        }
        const vaultBasePath = adapter.getBasePath();
        const fullDestinationPath = _path.join(vaultBasePath, destinationPath);
        const isDestinationExists = await app.vault.adapter.exists(destinationPath);

        if (isDestinationExists) {
            let resolution: ConflictResolution = globalResolution ?? { action: 'skip', applyToAll: false };
            // console.log(globalResolution);
            if (!globalResolution || globalResolution.applyToAll === false) {
                if (importConflict === 'prompt-user') {
                    resolution = await new Promise<ConflictResolution>((resolve) => {
                        const modal = new FileConflictModal(app, destinationPath, resolve);
                        modal.open();
                    });
                } else {
                    resolution = { action: importConflict as ConflictResolution['action'], applyToAll: false };
                }

                if (resolution.applyToAll) {
                    globalResolution = resolution; // Persist choice for future files
                }
                // console.log(globalResolution);
            }

            switch (resolution.action) {
                case 'skip':
                    if (!isSilent) new Notice(`Skipped: ${destinationPath}`);
                    return { success: true, destinationPath: '', error: 'Import skipped due to existing file' };
                case 'disambiguate':
                    destinationPath = await ensureUniquePath(app, destinationPath);
                    break;
                case 'replace':
                    break; // Overwrite existing file
            }
        }

        if (sourceFilePath && fullDestinationPath) {
            await copyFile(sourceFilePath, fullDestinationPath);
            updateHostFileHoldingsData(app, configuration, hostFilePath, destinationPath);
            if (!isSilent) new Notice(`Imported: ${destinationPath}`);
            return { success: true, destinationPath };
        }

        return {success: true, destinationPath: "", error: "File was not imported"}


    } catch (error) {
        return { success: false, destinationPath: '', error: `Import failed: ${error}` };
    }
}

export function updateHostFileHoldingsData(
    app: App,
    configuration: BibliosidianConfiguration,
    hostFilePath: string,
    newHoldingPath: string,
) {
    if (!hostFilePath) {
        return;
    }
    let fileProperties = new FileProperties(app, hostFilePath);
    let holdingsPropertyName = configuration.holdingsPropertyName;
    let refProperties: FilePropertyData = {}
    let formattedNewHoldingPath = `[[${newHoldingPath}]]`;
    refProperties[holdingsPropertyName] = fileProperties.concatItems(holdingsPropertyName, [formattedNewHoldingPath])
    updateFrontMatter(
        app,
        hostFilePath,
        refProperties,
        true,
    )
}

export function resolveFileTitle(
    app: App,
    refFilePath: string,
    titlePropertyNames: string[] = ["shorttitle", "title"],
): string {
    const refFileProperties = new FileProperties(app, refFilePath);
    const refFileTitle = refFileProperties.resolveFirstMatchingPropertyValue(titlePropertyNames);
    return refFileTitle;
}

export async function openAssociatedNote(
        app: App,
        refFilePath: string,
        refFileTitle: string,
        refNoteConfig: NoteConfiguration,
        linkedNoteConfig: NoteConfiguration,
        isForceNew: boolean = false,
        titlePropertyNames: string[] = ["shorttitle", "title"],
    ) {
    // let activeFile = app.workspace.getActiveFile();
    // if (!activeFile) {
    //     return;
    // }

    // const refFilePath = activeFile.path;
    refFileTitle = refFileTitle || resolveFileTitle(app, refFilePath, titlePropertyNames);
    const noteLocation = composeNoteLocation(
        refFilePath,
        linkedNoteConfig.parentFolderPath,
        linkedNoteConfig.namePrefix,
        linkedNoteConfig.namePostfix,
        linkedNoteConfig.isSubdirectorizeLexically,
    );

    let newNotePath = "";
    if (isForceNew) {
        newNotePath = await createUniqueNote(
            app,
            noteLocation.newFileBasename,
            noteLocation.newFileParentDir,
            "",
            undefined,
        )
    } else {
        newNotePath = await createOrOpenNote(
            app,
            noteLocation.newFilePath,
        )
    }
    let newNoteTitle = `${refFileTitle} ~ ${linkedNoteConfig.className}`;
    let refNoteLinkName = `${linkedNoteConfig.frontmatterPropertyNamePrefix}${refNoteConfig.associatedNotesOutlinkPropertyName}`
    updateFrontMatter(
        app,
        newNotePath,
        {
            "tags": linkedNoteConfig.tagMetadata.map( (tag) => tag.replace(/^#/,"") ),
            // [refNoteConfig.associatedNotesOutlinkPropertyName]: [ `[[${refFilePath.replace(/\.md$/,"")}|${refFileTitle}]]`, ],
            [refNoteLinkName]: [ `[[${refFilePath.replace(/\.md$/,"")}|${refFileTitle}]]`, ],
            "title": newNoteTitle,
        } ,
    );
}

export function getSourceFilesExternalAttachmentLocations(app: App, configuration: BibliosidianConfiguration, filePath: string ): string[] {
    const refData = readPropertyDict(app, filePath, configuration.biblioNoteDataPropertyName);
    const filePaths: string[] = Array.isArray(refData?.["file"]) && refData["file"].every(f => typeof f === "string") ? refData["file"] : [];
    return filePaths;
}

export function getCitationKey(app: App, configuration: BibliosidianConfiguration, filePath: string ): string[] {
    const refData = readPropertyDict(app, filePath, configuration.biblioNoteDataPropertyName);
    return refData["citation-key"];
}

