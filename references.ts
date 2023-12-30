import {
	App,
	TFile,
	CachedMetadata,
	// Editor,
	// MarkdownView,
	// Modal,
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
	updateFrontmatterYaml
} from "./fileProperties"


// import { parseBibFile } from "bibtex";
import * as _path from "path";

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
	targetFilePath: string,
    bibFileData: string,
    citeKey?: string,
    authorsParentFolderPath: string = "",
    fieldNamePrefix:string = "",
) {
	// let targetFile = app.vault.getAbstractFileByPath(targetFilePath)
	// if (!targetFile) {
	// 	return
	// }
	let bibToYamlLabelFn: (arg0:string) => string = (bibStr) => `${fieldNamePrefix}${bibStr}`
	let updateProperty = (bibTexField: string, values: string | string[]) => {
		let propertyName = bibToYamlLabelFn(bibTexField)
		if (values) {
			updateFrontmatterYaml(
				app,
				targetFilePath,
				propertyName,
				values,
			)
		} else {
			// clear?
		}
	}

	// Authors
	let authorLinks = generateAuthorLinks(
		bibFileData, // expecting single entry data
		undefined, // no citekey: first entry
		"sources/authors", // abstract away later; path to that author notes are stored
	)
	updateProperty("author", authorLinks)

	// let bibFieldMap: Record<string, string> = {
	// 	"date"
	// 	"title",
	// 	"doi"
	// 	"isbn"
	// 	"publisher",
	// 	"volume",
	// 	"url",
	// 	"issue"
	// 	"page",
	// 	"type",
	// }


}

export function generateAuthorLinks(
    bibFileData: string,
    citeKey?: string,
    parentFolderPath: string = "",
): string[] {
    let results: string[] = [];
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


