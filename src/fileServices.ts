
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
	Setting,
	normalizePath,
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
        console.log("OK")
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

export async function updateHostFileHoldingsData(
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
    await updateFrontMatter(
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

class ReferenceIndexModal extends Modal {
    private onConfirm: () => void;
    baseNotePath: string;
    linkedNotePath: string;
    indexMetadataPropertyName: string;

    constructor(
        app: App,
        baseNotePath: string,
        linkedNotePath: string,
        indexMetadataPropertyName: string,
        onConfirm: () => void,
    ) {
        super(app);
        this.onConfirm = onConfirm;
        this.baseNotePath = baseNotePath;
        this.linkedNotePath = linkedNotePath;
        this.indexMetadataPropertyName = indexMetadataPropertyName;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Confirm auxiliary note creation' });

        contentEl.createEl('p', { text: `The base note is missing the property: '${this.indexMetadataPropertyName}').` });
        contentEl.createEl('p', { text: "This may not be a reference index note" });

        // Fetch metadata
        const metadata = getMetadataCache(app, this.baseNotePath);
        const frontmatter = metadata?.frontmatter || {};
        let title = frontmatter.title ? frontmatter.title.trim() : '';

        this.createDisabledTextField(contentEl, 'Title', title);
        const baseFile = app.vault.getAbstractFileByPath(this.baseNotePath);
        if (baseFile && (baseFile instanceof TFile)) {
            this.createDisabledTextField(contentEl, 'Basename', baseFile.basename);
            this.createDisabledTextField(contentEl, 'Folder', baseFile.parent?.path || '');
        } else {
            this.createDisabledTextField(contentEl, 'Invalid note filepath', this.baseNotePath);
        }


        contentEl.createEl('p', { text: "Do you want to proceed with creating and attaching an auxiliary note?"});

        // Confirmation buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

        new ButtonComponent(buttonContainer)
            .setButtonText('Yes')
            .setCta()
            .onClick(() => {
                this.close();
                this.onConfirm();
            });

        new ButtonComponent(buttonContainer)
            .setButtonText('No')
            .onClick(() => {
                this.close();
            });
    }

    private createDisabledTextField(container: HTMLElement, label: string, value: string) {
        const wrapper = container.createDiv({ cls: 'disabled-text-field' });

        wrapper.createEl('label', { text: label, attr: { style: 'font-weight: bold; display: block; margin-bottom: 3px;' } });

        const input = wrapper.createEl('input', {
            attr: { type: 'text', value: value, readonly: 'true' }
        });

        input.style.width = '100%';
        input.style.marginBottom = '0.5em';
    }

    onClose() {
        this.contentEl.empty();
    }
}

// Modify `openAssociatedNote` function to trigger the modal
export async function openAssociatedNote(
    app: App,
    refFilePath: string,
    refFileTitle: string,
    refNoteConfig: NoteConfiguration,
    linkedNoteConfig: NoteConfiguration,
    isForceNew: boolean = false,
    titlePropertyNames: string[] = ["shorttitle", "title"],
) {
    const referenceNoteTypeIndexPropertyName = refNoteConfig.frontmatterPropertyNamePrefix + "index";
    const referenceNoteTypePropertyValue = getMetadataCache(app, refFilePath)?.frontmatter?.[referenceNoteTypeIndexPropertyName];

    const newNotePath = composeNoteLocation(
        refFilePath,
        linkedNoteConfig.parentFolderPath,
        linkedNoteConfig.namePrefix,
        linkedNoteConfig.namePostfix,
        linkedNoteConfig.isSubdirectorizeLexically,
    ).newFilePath;

    const existingFile = app.vault.getAbstractFileByPath(newNotePath);

    // If reference index data is missing, show modal
    if (!referenceNoteTypePropertyValue && !existingFile) {
        if (true) {
            await new Promise<void>((resolve) => {
                new ReferenceIndexModal(
                    app,
                    refFilePath,
                    referenceNoteTypeIndexPropertyName,
                    newNotePath,
                    resolve
                ).open();
            });
        } else {
            return; // Abort if file is invalid
        }
    }

    refFilePath = normalizePath(refFilePath);
    refFileTitle = refFileTitle || resolveFileTitle(app, refFilePath, titlePropertyNames);
    const noteLocation = composeNoteLocation(
        refFilePath,
        linkedNoteConfig.parentFolderPath,
        linkedNoteConfig.namePrefix,
        linkedNoteConfig.namePostfix,
        linkedNoteConfig.isSubdirectorizeLexically,
    );

    let finalNewNotePath = "";
    if (isForceNew) {
        finalNewNotePath = await createUniqueNote(
            app,
            noteLocation.newFileBasename,
            noteLocation.newFileParentDir,
            "",
            undefined,
        );
    } else {
        finalNewNotePath = await createOrOpenNote(
            app,
            noteLocation.newFilePath,
        );
    }

    finalNewNotePath = normalizePath(finalNewNotePath);
    let newNoteTitle = `${refFileTitle} ~ ${linkedNoteConfig.className}`;
    let refNoteLinkName = `${linkedNoteConfig.frontmatterPropertyNamePrefix}${refNoteConfig.associatedNotesOutlinkPropertyName}`;
    await updateFrontMatter(
        app,
        finalNewNotePath,
        {
            "tags": linkedNoteConfig.tagMetadata.map(tag => tag.replace(/^#/, "")),
            [refNoteLinkName]: [`[[${refFilePath.replace(/\.md$/, "")}|${refFileTitle}]]`],
            "title": newNoteTitle,
        },
    );

    let backlinkedRefNoteOutlinkingPropertyName = `${refNoteConfig.frontmatterPropertyNamePrefix}${linkedNoteConfig.associatedNotesOutlinkPropertyName}`;
    let backlinkedRefNoteOutlinkingDisplayText = linkedNoteConfig.className;
    let backlinkedRefNoteOutlink = `[[${finalNewNotePath.replace(/\.md$/, "")}|${backlinkedRefNoteOutlinkingDisplayText}s]]`;

    await updateFrontMatter(
        app,
        refFilePath,
        {
            [backlinkedRefNoteOutlinkingPropertyName]: [backlinkedRefNoteOutlink],
        },
    );
}



export function getSourceFilesExternalAttachmentLocations(
    app: App,
    configuration: BibliosidianConfiguration,
    filePath: string
): string[] {
    const refData = readPropertyDict(
        app,
        filePath,
        configuration.biblioNoteDataPropertyName
    );
    const filePaths: string[] = Array.isArray(refData?.["file"]) && refData["file"].every(f => typeof f === "string") ? refData["file"] : [];
    return filePaths;
}

export function getCitationKey(app: App, configuration: BibliosidianConfiguration, filePath: string ): string[] {
    const refData = readPropertyDict(app, filePath, configuration.biblioNoteDataPropertyName);
    return refData["citation-key"];
}

