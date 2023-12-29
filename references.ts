import {
	App,
	TFile,
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
	FieldValue
} from "bibtex";
// import { parseBibFile } from "bibtex";
import * as _path from "path";


export function test1() {
    const bibFile = parseBibFile(`
@Book{gros2011,
  author           = {Gros, Claudius},
  date             = {2011},
  title            = {Complex and Adaptive Dynamical Systems},
  doi              = {10.1007/978-3-642-04706-0},
  isbn             = {9783642047060},
  publisher        = {Springer Berlin Heidelberg},
  creationdate     = {2023-12-27T04:03:39},
  modificationdate = {2023-12-27T04:03:39},
}
`); // your BibTeX string

    const entry = bibFile.getEntry("gros2011");

    if (entry) {
        const fieldValue = normalizeFieldValue(entry.getField("title"))
        console.log(fieldValue)

        const authorField = entry.getField("author");
        console.log(authorField)
        if (authorField && typeof authorField === 'object' && 'authors$' in authorField) {
            let result = (authorField as any).authors$.map((author: any, i: number) => {
                return "Author: " +
                    (author.firstNames
                        .concat(author.vons)
                        .concat(author.lastNames)
                        .concat(author.jrs)).join(" ");
            });
            console.log(result);
        }
    }
}

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

export function generateAuthorLinks(
    bibFileData: string,
    citeKey: string,
    parentFolderPath: string
): string[] {
    let results: string[] = [];
    const bibFile = parseBibFile(bibFileData);
    const entry = bibFile.getEntry(citeKey);

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

// export async function updateYAMLProperty(
// 	app: App,
// 	filePath: string,
// 	propertyName: string,
// 	newValues: string[],
// ) {
//     const file = app.vault.getAbstractFileByPath(filePath);
//     if (file instanceof TFile) {
//         let content = await app.vault.read(file);
//         const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
//         const match = content.match(frontmatterRegex);
//         let newYAML;
//         if (match) {
//             let frontmatter = match[1];
//             let frontmatterLines: string[] = frontmatter.split("\n");
//             let updatedLines = frontmatterLines.filter(line => !line.trim().startsWith(`${propertyName}:`));
//             let multilineValue = newValues.map(value => `  - ${value}`).join("\n");
//             updatedLines.push(`${propertyName}:\n${multilineValue}`);
//             newYAML = updatedLines.join("\n");
//             content = content.replace(frontmatterRegex, `---\n${newYAML}\n---`);
//         } else {
//             // No frontmatter, add new one
//             let multilineValue = newValues.map(value => `  - ${value}`).join("\n");
//             newYAML = `---\n${propertyName}:\n${multilineValue}\n---`;
//             content = newYAML + "\n" + content;
//         }

//         await app.vault.modify(file, content);
//     } else {
//         console.error("File not found");
//     }
// }

export async function updateYAMLProperty(
	app: App,
	filePath: string,
	propertyName: string,
	newValues: string[],
) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
        let content = await app.vault.read(file);
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);
        let newYAML;
        if (match) {
            let frontmatter = match[1];
            let frontmatterLines: string[] = frontmatter.split("\n");
            let retainedLines = frontmatterLines.filter(line => !line.trim().startsWith(`${propertyName}:`));
            let updatedLines = []
            let multilineValue = newValues.map(value => `  - ${value}`).join("\n");
            updatedLines.push(`${propertyName}:\n${multilineValue}`);
            newYAML = retainedLines.concat(updatedLines).join("\n");
            content = content.replace(frontmatterRegex, `---\n${newYAML}\n---`);
        } else {
            // No frontmatter, add new one
            let multilineValue = newValues.map(value => `  - ${value}`).join("\n");
            newYAML = `---\n${propertyName}:\n${multilineValue}\n---`;
            content = newYAML + "\n" + content;
        }

        await app.vault.modify(file, content);
    } else {
        console.error("File not found");
    }
}

