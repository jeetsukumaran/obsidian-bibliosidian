import { FilePropertyData } from './fileProperties'; // Import the correct type

import {
    App,
    TAbstractFile,
    TFile,
    TFolder,
    PaneType,
} from 'obsidian';
import * as path from 'path';

export async function createOrOpenNote(
    app: App,
    filePath: string,
    isOpenNote: boolean = true,
    mode: PaneType | boolean = false,
): Promise<string> {

    // const path = require('path');
    let notePath = filePath;
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

// export async function ensureParentDirectoryExists(app: App, filePath: string): Promise<void> {
//     const parentDirPath = filePath.substring(0, filePath.lastIndexOf('/'));

//     // Check if the parent directory exists
//     let parentDir = app.vault.getAbstractFileByPath(parentDirPath) as TFolder;

//     if (!parentDir) {
//         // Create the parent directory if it doesn't exist
//         await createDirectory(app, parentDirPath);
//     }
// }

export async function ensureDirectoryExists(app: App, dirPath: string): Promise<void> {
    // Check if the parent directory exists

    let dirNode = app.vault.getAbstractFileByPath(dirPath) as TFolder;
    if (!dirNode) {
        // Create the parent directory if it doesn't exist
        await app.vault.createFolder(dirPath);
    }
}

// export async function createDirectory(app: App, dirPath: string): Promise<TFolder> {
//     const pathParts = dirPath.split('/').filter(part => part.length);

//     let currentPath = '';
//     let currentDir: TAbstractFile | null = null;

//     for (const part of pathParts) {
//         currentPath += '/' + part;
//         currentDir = app.vault.getAbstractFileByPath(currentPath);

//         if (!currentDir) {
//             // Create the directory if it doesn't exist
//             currentDir = await app.vault.createFolder(currentPath);
//         }
//     }

//     return currentDir as TFolder;
// }

export async function createUniqueNote(
    app: App,
    directoryPath: string,
    content: string,
    mode: PaneType | undefined,
): Promise<string> {

    const path = require('path');
    let counter = 0;
    let newNotePath;

    do {
        const fileName = `Untitled${counter ? ` ${counter}` : ''}.md`;
        newNotePath = path.join(directoryPath, fileName);
        counter++;
    } while (await app.vault.adapter.exists(newNotePath));

    try {
        await app.vault.create(newNotePath, content);
        app.workspace.openLinkText(newNotePath, '', mode);
    } catch (error) {
        console.error('Error creating or opening the new note:', error);
    }
    return newNotePath
}

export async function ensureUniquePath(app: App, fullPath: string): Promise<string> {
    let counter = 1;
    const directoryPath = path.dirname(fullPath);
    const baseName = path.basename(fullPath);
    let fileName = baseName;
    let newFullPath = fullPath;

    while (await app.vault.adapter.exists(newFullPath)) {
        const extension = path.extname(baseName);
        const nameWithoutExtension = path.basename(baseName, extension);
        fileName = `${nameWithoutExtension}_${counter}${extension}`;
        newFullPath = path.join(directoryPath, fileName);
        counter++;
    }

    return newFullPath;
}


// export async function formatAttachmentPath(
//     app: App,
//     hostFile: TFile,
//     sourceFilePath: string,
//     destinationFolderPath: string
// ): Promise<string> {
//     // Use host file's directory if destinationFolderPath is empty
//     if (!destinationFolderPath) {
//         destinationFolderPath = path.dirname(hostFile.path);
//     }
//     else {
//         // Ensure destination folder exists
//         await ensureDirectoryExists(app, destinationFolderPath);
//         ensureParentDirectoryExists
//     }

//     // Get the extension from the source file
//     const extension = path.extname(sourceFilePath);

//     // Construct the new filename
//     const hostFileNameWithoutExtension = path.basename(hostFile.path, path.extname(hostFile.path));
//     let newFilePath = path.join(
//         destinationFolderPath,
//         hostFileNameWithoutExtension + extension,
//     );

//     // Ensure the new file path is unique
//     newFilePath = await ensureUniquePath(app, newFilePath);

//     return newFilePath;
// }

/**
 * Normalize a multi-line string of tags into a dictionary with 'tags' as the key.
 * Each tag is trimmed and leading '#' is removed if present.
 * @param input Multi-line string of tags.
 * @returns Normalized dictionary with 'tags' as key and list of tags as value.
 */
// export function normalizeTagInput(input: string): FilePropertyData {
//     const tags = input.split('\n')
//         .map(tag => tag.trim().replace(/^#+/, ''))
//         .filter(tag => tag !== '');
//     return { tags };
// }

export function splitStringArray(input: string): string[] {
    if (!input) {
        return [];
    }
    const vals: string[] = input
                            .split(/\\s,;/)
                            .map( (s) => s.trim() );
    return vals;
}

export function ensureStringArray(input: any): string[] {
    if (!input) {
        return [];
    }
    if (Array.isArray(input)) {
        return input.map( (i) => i.toString() );
    } else {
        return [ input.toString() ];
    }
}

export function composeNoteLocation(
    sourceFileTitle: string,
    targetFilePrefix: string,
    targetFileParentFolder: string,
    isSubdirectorizeLexically: boolean,
): { [key:string]: string,} {
    // const sourceFileNormalizedName = sourceFileTitle.replace(/^@/,"").replace(/.md$/, "");
    const sourceFileNormalizedName = sourceFileTitle
                                    .replace(/^@/,"")
                                    .replace(/.md$/, "");
    let newFileParentDir;
    if (isSubdirectorizeLexically) {
        const firstLetter = sourceFileNormalizedName.charAt(0).toLowerCase();
        newFileParentDir = `${targetFileParentFolder}/${firstLetter}/`;
    } else {
        newFileParentDir = targetFileParentFolder + "/";
    }
    const newFileBasename = `${targetFilePrefix}${sourceFileNormalizedName}.md`;
    const newFilePath = `${newFileParentDir}/${newFileBasename}`;
    return {
        newFileParentDir: newFileParentDir,
        newFileBasename: newFileBasename,
        newFilePath: newFilePath,
    };
}


/**
 * Validates and normalizes Obsidian tags.
 *
 * @param tags - Array of tag strings to be validated and normalized.
 * @param prefixHash - If true, ensures the tags have a leading '#'; otherwise, removes it.
 * @returns A list of valid, normalized tag strings.
 */
export function normalizeObsidianTags(tags: string[], prefixHash: boolean): string[] {
    const tagPattern = /^#?([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)$/;

    return tags
        .map(tag => tag.trim()) // Remove leading/trailing spaces
        .filter(tag => tagPattern.test(tag)) // Validate format
        .map(tag => {
            let normalizedTag = tag.replace(/^#/, ""); // Remove leading #
            return prefixHash ? `#${normalizedTag}` : normalizedTag;
        });
}
