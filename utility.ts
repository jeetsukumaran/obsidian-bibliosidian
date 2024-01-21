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

export async function ensureParentDirectoryExists(app: App, filePath: string): Promise<void> {
    const parentDirPath = filePath.substring(0, filePath.lastIndexOf('/'));

    // Check if the parent directory exists
    let parentDir = app.vault.getAbstractFileByPath(parentDirPath) as TFolder;

    if (!parentDir) {
        // Create the parent directory if it doesn't exist
        await createDirectory(app, parentDirPath);
    }
}

export async function createDirectory(app: App, dirPath: string): Promise<TFolder> {
    const pathParts = dirPath.split('/').filter(part => part.length);

    let currentPath = '';
    let currentDir: TAbstractFile | null = null;

    for (const part of pathParts) {
        currentPath += '/' + part;
        currentDir = app.vault.getAbstractFileByPath(currentPath);

        if (!currentDir) {
            // Create the directory if it doesn't exist
            currentDir = await app.vault.createFolder(currentPath);
        }
    }

    return currentDir as TFolder;
}

export async function createUniqueNote(
    app: App,
    directoryPath: string,
    frontmatter: string,
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
        await app.vault.create(newNotePath, frontmatter);
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
