
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

import {
    AssociatedNoteSettings,
} from "./settings";

import {
    ensureStringArray,
    createOrOpenNote,
    composeNoteLocation,
    createUniqueNote,
} from "./utility";

import {
	FilePropertyData,
	updateFrontMatter,
} from "./fileProperties";

export async function openAssociatedNote(
        app: App,
        noteConfig: AssociatedNoteSettings,
        isForceNew: boolean = false,
    ) {
    let activeFile = app.workspace.getActiveFile();
    if (!activeFile) {
        return;
    }

    let refFileTitle = "hello";

    const noteLocation = composeNoteLocation(
        activeFile.path,
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
    updateFrontMatter(
        app,
        newNotePath,
        {
            "tags": noteConfig.tagMetadata.map( (tag) => tag.replace(/^#/,"") ),
            [noteConfig.returnLinkPropertyName]: [ `[[${activeFile.path}|${refFileTitle}]]`, ],
        } ,
    );
}

