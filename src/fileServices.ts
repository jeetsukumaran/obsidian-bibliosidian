
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
    AssociatedNoteSettings,
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
        noteConfig: AssociatedNoteSettings,
        isForceNew: boolean = false,
        titlePropertyNames: string[] = ["link-title", "title"],
    ) {
    let activeFile = app.workspace.getActiveFile();
    if (!activeFile) {
        return;
    }

    const refFilePath = activeFile.path;
    const refFileProperties = new FileProperties(app, refFilePath);
    const refFileBaseName = _path.basename(activeFile.path);
    const refFileTitle = titlePropertyNames
        .map(propertyName => refFileProperties.readPropertyString(propertyName))
        .find(propertyValue => propertyValue) ?? refFileBaseName;

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
    updateFrontMatter(
        app,
        newNotePath,
        {
            "tags": noteConfig.tagMetadata.map( (tag) => tag.replace(/^#/,"") ),
            [noteConfig.returnLinkPropertyName]: [ `[[${activeFile.path}|${refFileTitle}]]`, ],
        } ,
    );
}

