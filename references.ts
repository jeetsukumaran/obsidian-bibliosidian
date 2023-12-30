import {
	App,
	TFile,
	CachedMetadata,
	// Editor,
	// MarkdownView,
	// Modal,
	// Notice,
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


// npm install yaml
// import YAML from "yaml";
const YAML = require('yaml')


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
	let authorsYamlLabel = bibToYamlLabelFn("author")

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

	// Authors
	let authorLinks = generateAuthorLinks(
		bibFileData, // expecting single entry data
		undefined, // no citekey: first entry
		"sources/authors", // abstract away later; path to that author notes are stored
	)
	if (authorLinks) {
		replaceYAMLProperty(
			app,
			targetFilePath,
			authorsYamlLabel,
			authorLinks,
		)
	}

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

            return `"[[${authorFilePath}|${authorDisplayName}]]"`;
        });
    }
    return results;
}

export async function updateYAMLProperty(
	app: App,
	filePath: string,
	propertyName: string,
	newValues: string[],
) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {

		// let frontmatter = app.metadataCache?.getFileCache(file)?.frontmatter
		// console.log(app.metadataCache)
		// if (frontmatter) {
		// 	frontmatter["source-authors"] = "hello"
		// }
		// let frontMatter = this.metadataCache?.frontmatter
		// console.log(frontmatter)

        let content = await app.vault.read(file);
		let updatedRows = newValues.map(value => `  - ${value}`)
        let newYAML;
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const frontMatterMatch = content.match(frontmatterRegex);
        if (frontMatterMatch) {
            let frontmatter = frontMatterMatch[1];
            let frontmatterLines: string[] = frontmatter.split("\n");
            let updatedLines: string[] = []
            let isUpdatedExisting = false
            frontmatterLines.forEach( (line: string) => {
				// let propRx = new RegExp(`^(\\s+)${propertyName}`);
				let propRx = new RegExp(`^(\\s+)${propertyName}`);
				// let propRx = new RegExp(`^(\\s+)${propertyName}\\s*:\\s*$`);
				let propMatch = line.match(/source-authors:/)
				if (propMatch) {
					// rewrite field name in case it had inline data/values
					// TODO: save these?
					updatedLines.push(`${propertyName}:`)
					// insert new rows here;
					// previous entries will be appended after as loop proceeds
					updatedLines.push(... updatedRows)
					isUpdatedExisting = true
				} else {
					updatedLines.push(line)
				}
            })
            if (!isUpdatedExisting) {
            	updatedLines.push(`${propertyName}:`)
            	updatedLines.push(... updatedRows)
            }
            newYAML = updatedLines.join("\n");
            content = content.replace(frontmatterRegex, `---\n${newYAML}\n---`);
        } else {
            newYAML = `---\n${propertyName}:\n${updatedRows.join("\n")}\n---`;
            content = newYAML + "\n" + content;
        }

        await app.vault.modify(file, content);
    } else {
        console.error("File not found");
    }
}

export async function replaceYAMLProperty(
	app: App,
	filePath: string,
	propertyName: string,
	newValues: string[],
) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {

		// let frontmatter = app.metadataCache?.getFileCache(file)?.frontmatter
		// console.log(app.metadataCache)
		// if (frontmatter) {
		// 	frontmatter["source-authors"] = "hello"
		// }
		// let frontMatter = this.metadataCache?.frontmatter
		// console.log(frontmatter)

        let content = await app.vault.read(file);
		let updatedRows = newValues.map(value => `  - ${value}`)
        let newYAML;
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const frontMatterMatch = content.match(frontmatterRegex);
        if (frontMatterMatch) {
            let frontmatter = frontMatterMatch[1];
			let parsedFrontmatter;
			try {
				parsedFrontmatter = YAML.parse(frontmatter)
			} catch (err) {
				console.log(err)
			}
            console.log(parsedFrontmatter)
            let frontmatterLines: string[] = frontmatter.split("\n");
            let updatedLines: string[] = []
            let isUpdatedExisting = false
            frontmatterLines.forEach( (line: string) => {
				// let propRx = new RegExp(`^(\\s+)${propertyName}`);
				let propRx = new RegExp(`^(\\s+)${propertyName}`);
				// let propRx = new RegExp(`^(\\s+)${propertyName}\\s*:\\s*$`);
				let propMatch = line.match(/source-authors:/)
				if (propMatch) {
					// rewrite field name in case it had inline data/values
					// TODO: save these?
					updatedLines.push(`${propertyName}:`)
					// insert new rows here;
					// previous entries will be appended after as loop proceeds
					updatedLines.push(... updatedRows)
					isUpdatedExisting = true
				} else {
					updatedLines.push(line)
				}
            })
            if (!isUpdatedExisting) {
            	updatedLines.push(`${propertyName}:`)
            	updatedLines.push(... updatedRows)
            }
            newYAML = updatedLines.join("\n");
            content = content.replace(frontmatterRegex, `---\n${newYAML}\n---`);
        } else {
            newYAML = `---\n${propertyName}:\n${updatedRows.join("\n")}\n---`;
            content = newYAML + "\n" + content;
        }

        await app.vault.modify(file, content);
    } else {
        console.error("File not found");
    }
}

