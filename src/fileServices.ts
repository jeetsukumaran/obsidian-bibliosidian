
import {
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

import {
    NoteConfiguration,
} from "./settings";

import {
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

export async function openAssociatedNote(
        app: App,
        noteConfig: NoteConfiguration,
        isForceNew: boolean = false,
        titlePropertyNames: string[] = ["shorttitle", "title"],
    ) {
    let activeFile = app.workspace.getActiveFile();
    if (!activeFile) {
        return;
    }

    const refFilePath = activeFile.path;
    const refFileProperties = new FileProperties(app, refFilePath);
    const refFileBaseName = _path.basename(activeFile.path);
    const refFileTitle = refFileProperties.resolveFirstMatchingPropertyValue(titlePropertyNames);

    const noteLocation = composeNoteLocation(
        refFilePath,
        noteConfig.parentFolderPath,
        noteConfig.namePrefix,
        noteConfig.namePostfix,
        noteConfig.isSubdirectorizeLexically,
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
    let newNoteTitle = `${refFileTitle} (${noteConfig.className})`;
    updateFrontMatter(
        app,
        newNotePath,
        {
            "tags": noteConfig.tagMetadata.map( (tag) => tag.replace(/^#/,"") ),
            [noteConfig.returnLinkPropertyName]: [ `[[${refFilePath.replace(/\.md$/,"")}|${refFileTitle}]]`, ],
            "title": newNoteTitle,
        } ,
    );
}

