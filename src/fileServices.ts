
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
    const refFileTitle = resolveFileTitle(app, refFilePath, titlePropertyNames);
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
    let newNoteTitle = `${refFileTitle} (${linkedNoteConfig.className})`;
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

