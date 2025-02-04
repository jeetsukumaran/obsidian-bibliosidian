
import {
    TFile,
    FileSystemAdapter,
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
	FileProperties,
	FilePropertyData,
	updateFrontMatter,
} from "./fileProperties";


const copyFile = promisify(fs.copyFile);
const fileExists = promisify(fs.access);

interface ImportResult {
    success: boolean;
    destinationPath: string;
    error?: string;
}

export async function importHolding(
    app: App,
    configuration: BibliosidianConfiguration,
    hostFilePath: string,
    sourceFilePath: string
): Promise<ImportResult> {
    try {
        // Validate inputs
        if (!hostFilePath || !sourceFilePath) {
            return {
                success: false,
                destinationPath: '',
                error: 'Host file path or source file path is empty'
            };
        }

        // Validate source file exists
        try {
            await fileExists(sourceFilePath);
        } catch {
            return {
                success: false,
                destinationPath: '',
                error: `Source file does not exist: ${sourceFilePath}`
            };
        }

        // Get the host file details
        const hostFile = app.vault.getAbstractFileByPath(hostFilePath);
        if (!(hostFile instanceof TFile)) {
            return {
                success: false,
                destinationPath: '',
                error: 'Host file not found or is not a file'
            };
        }

        // Calculate destination path
        const destExtension = _path.extname(sourceFilePath);
        const hostFileNameWithoutExtension = _path.basename(
            hostFile.path,
            _path.extname(hostFile.path)
        );

        let destinationFilename = hostFileNameWithoutExtension + destExtension;
        if (destinationFilename.startsWith("@")) {
            destinationFilename = destinationFilename.slice(1);
        }

        // Handle parent path and subdirectories
        let parentPath = configuration.holdingsParentFolder;
        if (configuration.biblioNoteConfiguration.isSubdirectorizeLexically) {
            let holdingSubDir = destinationFilename[0] === "@" ? destinationFilename[1] : destinationFilename[0];
            if (holdingSubDir === "@") {
                holdingSubDir = hostFile.path[1];
            }
            parentPath = _path.join(parentPath, holdingSubDir);
        }

        let destinationPath = _path.join(parentPath, destinationFilename);

        // Ensure directory exists and path is unique
        await ensureDirectoryExists(app, _path.dirname(destinationPath));
        destinationPath = await ensureUniquePath(app, destinationPath);

        // Get vault base path
        const adapter = app.vault.adapter;
        if (!(adapter instanceof FileSystemAdapter)) {
            return {
                success: false,
                destinationPath: '',
                error: 'Could not access vault file system'
            };
        }
        const vaultBasePath = adapter.getBasePath();
        const fullDestinationPath = _path.join(vaultBasePath, destinationPath);

        // Copy the file
        await copyFile(sourceFilePath, fullDestinationPath);

        // Update host file's holdings data
        updateHostFileHoldingsData(app, configuration, hostFilePath, destinationPath);

        return {
            success: true,
            destinationPath: destinationPath
        };

    } catch (error) {
        return {
            success: false,
            destinationPath: '',
            error: `Import failed: ${error}`
        };
    }
}

function updateHostFileHoldingsData(
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
    let newNoteTitle = `${refFileTitle} -- [${linkedNoteConfig.className}]`;
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

