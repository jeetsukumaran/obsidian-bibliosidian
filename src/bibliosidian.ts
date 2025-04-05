import {
	App,
	TFile,
	CachedMetadata,
	PaneType,
	// Editor,
	// MarkdownView,
	Modal,
	Notice,
	// Plugin,
	// PluginSettingTab,
	Setting,
	BaseComponent,
	ButtonComponent,
	TextComponent,
	TextAreaComponent,
	// WorkspaceLeaf,
	// setIcon,
} from 'obsidian';

import {
	Authors,
	parseBibFile,
	normalizeFieldValue,
	BibEntry,
	EntryFields,
	FieldValue,
	parseAuthorName,
    BibFilePresenter,
    parseBibEntriesAndNonEntries,
} from "bibtex";

import {
	FileProperties,
	FilePropertyData,
	updateFrontMatter,
} from "./fileProperties";

import {
	openAssociatedNote,
} from "./fileServices";

import {
    createOrOpenNote,
    getDateStamp,
} from "./utility";

import {
    NoteConfiguration,
    BibliosidianConfiguration,
    BIBLIO_NOTE_RECORD_SUFFIX,
} from "./settings";

// import { parseBibFile } from "bibtex";
import * as _path from "path";

interface BibTexModalArgs {
    sourceBibTex: string;
    targetFilepath: string;
	isCreateAuthorNotes: boolean;
    isOpenNote: boolean;
}

interface Author {
    lastNames: string[],
    vons: string[],
    firstNames: string[],
    jrs: string[]
}

/**
 * Extracts an array of strings from a BibTeX field value.
 * Handles both single values and delimiter-separated lists.
 */
export function getFieldAsStringArray(
    entry: BibEntry | undefined,
    fieldName: string,
    separator: string = ";"
): string[] {
    if (!entry) {
        return [];
    }

    const fieldValue = entry.getFieldAsString(fieldName);
    if (!fieldValue) {
        return [];
    }

    // Handle array input
    // if (Array.isArray(fieldValue)) {
    //     return fieldValue.flatMap(item => {
    //         const itemStr = item.toString().trim();
    //         return itemStr.includes(separator)
    //             ? itemStr.split(separator).map( (s: string) => s.trim()).filter( (s: string) => s.length > 0)
    //             : [itemStr];
    //     });
    // }

    // Convert to string and split
    const valueStr = fieldValue.toString();
    return valueStr
        .split(separator)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
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
                             ) || "author";

    return {
        displayName: displayNameParts.join(", "),
        normalizedFileName: normalizedFileName,
    }
}

function cleanText(s: string | undefined): string {
    if (s) {
        return s
            .trim()
            .replace(/\n/g, " ")
            .replace(/\s+/g, " ")
            .replace(/``/g, '"')
            .replace(/`/g, "'")
            .replace(/<i>/g, "*")
            .replace(/<\/i>/g, "*")
    } else {
        return ""
    }
}

function resolveBibtexTitle(bibEntry: BibEntry): string {
	let bibTitle = bibEntry.title$ || cleanText(bibEntry.getFieldAsString("title")?.toString());
	let titleParts = [
		cleanText(bibTitle),
		cleanText(bibEntry.getFieldAsString("subtitle")?.toString()),
	].filter( (p) => p );
	let compositeTitle = cleanText(titleParts.join(": "));
	return compositeTitle;
}

async function generateSourceFrontmatter(
	app: App,
	configuration: BibliosidianConfiguration,
	args: BibTexModalArgs,
    citeKey?: string,
) {

	// let bibToYamlLabelFn: (arg0:string) => string = (bibStr) => `${configuration.biblioNoteSourcePropertiesPrefix}${bibStr}`

    let { bibEntry, bibtexStr, fieldValueMap } = getBibEntry(args.sourceBibTex, citeKey)

    if (!bibEntry) {
    	new Notice("Bibliographic note data could not be resolved")
    	return
    }

	let citationKey = bibEntry._id.toLowerCase();
    let noteProperties: FilePropertyData = {}; // unprefixed, part of the knowledge network or semantic layer: e.g. "title", "abstract", "authors"
    let refProperties: FilePropertyData = {}; // will be prefixed by namespace, e.g. "bibliographic-reference-"
    let refBibliographicalData: FilePropertyData = {}; // in subdictionary

    // refProperties["authority"] = refBibliographicalData;
    refProperties[BIBLIO_NOTE_RECORD_SUFFIX] = refBibliographicalData;


	let authorLastNames: string[] = [];
	// let auFieldNames: string[] = [
	//     "author",
    	// "editor",
    // ];
    // auFieldNames.forEach( (auFieldName) => {
    let creatorNames: { [key: string]: Authors } = {};
    for (let creatorTypeName of ["author", "editor"]) {
        let fieldValue: FieldValue = bibEntry?.fields[creatorTypeName] as FieldValue
        if (!fieldValue) {
            continue;
        }
        let authors: Authors;
        try {
            authors = new Authors(fieldValue);
        } catch(error) {
            console.error(`Error creating author for value ${fieldValue}: ${error}`);
            continue;
        }
        creatorNames[creatorTypeName] = authors;
        try {
            authors.authors$?.forEach((author: any) => {
                let lastName = author?.lastNames ? author.lastNames.join(" ") : ""
                if (lastName) {
                    authorLastNames.push(lastName);
                }
            });
        } catch (error) {
            console.error(`Error creating author for value ${fieldValue}: ${error}`);
        }

    };
	let compositeTitle = resolveBibtexTitle(bibEntry);
	let sourceYear = normalizeFieldValue( bibEntry.getField("date") ) || normalizeFieldValue( bibEntry.getField("year") )
	let inTextCitationYear = sourceYear
	let inTextCitationAuthors: string;
	if (authorLastNames.length == 1) {
		inTextCitationAuthors = authorLastNames[0]
	} else if (authorLastNames.length == 2) {
		inTextCitationAuthors = `${authorLastNames[0]} and ${authorLastNames[1]}`
	} else {
		inTextCitationAuthors = `${authorLastNames[0]} et al.`
	}
	let inTextCitation: string = `(${inTextCitationAuthors.trim()} ${inTextCitationYear?.toString().trim()})`

	let fileProperties = new FileProperties(this.app, args.targetFilepath)
    const updateDateStamp = getDateStamp();
    noteProperties["date-modified"] = updateDateStamp;

	// let entryTitle = `${inTextCitation} *${compositeTitle}*`
	let unformattedEntryTitle = `${inTextCitation}: ${compositeTitle}`
	let abstract = cleanText( (bibEntry.getFieldAsString("abstract")?.toString() || "") )
	// let entryTitle = `(@${citationKey}) ${compositeTitle}`
    let internalLinkPath = args.targetFilepath.replace(/\.md$/, "");
    let basenameWithoutExtension: string = _path.basename(args.targetFilepath, ".md");
    let citationStrings: string[] = [
        `[@${citeKey}]: *[[${internalLinkPath}|${compositeTitle}]]*`,
        // `@${citationKey}`,
        // `[@${citationKey}]`,
        // `[[@${citationKey}]]`,
        `${unformattedEntryTitle}`,
        // `${inTextCitation}`,
        // `"[[${internalLinkPath}]]"`,
        // `[[${internalLinkPath}|${unformattedEntryTitle}]]`,
        // `[[${internalLinkPath}|@${citationKey}]]`,
    ];
    let quotedAbstractLines: string[] = [
        "> [!quote] Abstract",
        ">",
        `> > ${abstract ? abstract : '...'}`,
        ">",
        `> -- [[@${citationKey}]]: [[${internalLinkPath}|${compositeTitle}]]`,
        "",
    ]
    // special meta-metadata for bibliosidian management

    const composeRefPropertyKey = (key: string) => {
        return `${configuration.biblioNoteConfiguration.frontmatterPropertyNamePrefix || ""}${key}`;
    };


    refBibliographicalData["citation-key"] = citationKey;
    refBibliographicalData["citation-strings"] = citationStrings;
    for (const [key, value] of Object.entries(creatorNames)) {
        if (!bibEntry) {
            continue;
        }
        let authorLinks = await generateAuthorLinks(
            app,
            configuration,
            args,
            bibEntry,
            `${inTextCitation} ${compositeTitle}`,
            [value],
        );
        refBibliographicalData[key] = authorLinks.map((link) => link.displayName);
        let refKey: string = key.endsWith("s") ? key : key + "s";
        // noteProperties[refKey] = authorLinks.map((link) => link.aliasedLink);
        refProperties[refKey] = authorLinks.map((link) => link.aliasedLink);
    }

	refBibliographicalData["registration-date"] = updateDateStamp
    refBibliographicalData["date"] = sourceYear
    refBibliographicalData["title"] = compositeTitle
    refBibliographicalData["abstract"] = abstract;
	refBibliographicalData["journal"] = bibEntry.getFieldAsString("journal")
	refBibliographicalData["volume"] = bibEntry.getFieldAsString("volume")
	refBibliographicalData["number"] = bibEntry.getFieldAsString("number")
	refBibliographicalData["pages"] = bibEntry.getFieldAsString("pages")
	refBibliographicalData["doi"] = bibEntry.getFieldAsString("doi")
	refBibliographicalData["url"] = bibEntry.getFieldAsString("url")
	refBibliographicalData["publisher"] = bibEntry.getFieldAsString("publisher")
	refBibliographicalData["booktitle"] = bibEntry.getFieldAsString("booktitle")
	refBibliographicalData["editor"] = bibEntry.getFieldAsString("editor")
	refBibliographicalData["keywords"] = bibEntry.getFieldAsString("keywords")
	refBibliographicalData["series"] = bibEntry.getFieldAsString("series")
	refBibliographicalData["address"] = bibEntry.getFieldAsString("address")
	refBibliographicalData["edition"] = bibEntry.getFieldAsString("edition")
	refBibliographicalData["chapter"] = bibEntry.getFieldAsString("chapter")
	refBibliographicalData["note"] = bibEntry.getFieldAsString("note")
	refBibliographicalData["institution"] = bibEntry.getFieldAsString("institution")
	refBibliographicalData["month"] = bibEntry.getFieldAsString("month")
	refBibliographicalData["school"] = bibEntry.getFieldAsString("school")
	refBibliographicalData["thesis"] = bibEntry.getFieldAsString("thesis")
	refBibliographicalData["howpublished"] = bibEntry.getFieldAsString("howpublished")
	refBibliographicalData["shorttitle"] = bibEntry.getFieldAsString("shorttitle")
	refBibliographicalData["bibtex"] = bibtexStr
    refBibliographicalData["file"] = getFieldAsStringArray(bibEntry, "file");

    const tagProperties = configuration.biblioNoteConfiguration.tagMetadata.map( (s) => s.replace(/^#/,"") );
	noteProperties["title"] = `${inTextCitation}: ${compositeTitle}`
	noteProperties["aliases"] = [
        noteProperties["title"],
	]
	if (abstract) {
		noteProperties["abstract"] = abstract
	}

	// if (refBibliographicalData["shorttitle"]) {
	// 	noteProperties["legend"] = refBibliographicalData["shorttitle"]
	// }

    // process attachments
    // refProperties[bibToYamlLabelFn("files")] = bibEntry.getFieldAsString("file")
    await updateFrontMatter(
    	this.app,
    	args.targetFilepath,
        {
            "tags": tagProperties,
            // ... refProperties.map( (p) => configuration.composeBiblioNotePropertyName(p) ),
            ...Object.fromEntries(
                Object.entries(refProperties).map(
                    ([key, value]) => [configuration.composeBiblioNotePropertyName(key), value]
                )
            ),
            ... noteProperties
        },
    	// refBodyLines,
    	true,
    )

    Object.keys(configuration.settings.associatedNoteConfigurations).forEach( async (noteConfigKey: string) => {
        const noteConfig: NoteConfiguration = configuration.settings.associatedNoteConfigurations[noteConfigKey];
        if (noteConfig.isAutoCreate) {
            await openAssociatedNote(
                app,
                args.targetFilepath,
    	        compositeTitle,
                configuration.biblioNoteConfiguration,
                noteConfig,
                false,
            )
        }

    });

}

function cleanBibFileData(bibFileData: string): string {
    bibFileData = bibFileData.replace(/month\s*=\s*([a-zA-Z0-9]+)\s*,/g,"month = {$1},");
    return bibFileData;
}


function postProcessBibEntry(entry: BibEntry | undefined): {
		bibEntry: BibEntry | undefined,
		bibtexStr: string,
		fieldValueMap: { [key: string]: string },
		indexTitle: string,
} {
	let fieldValueMap:{ [key: string]: string } = {}
	let bibtexStrParts = []
	if (entry !== undefined) {
		// let entryFields: EntryFields = bibEntry.fields$?.forEach( [key: string]: value: FieldValue
		let entryFields: EntryFields = entry.fields
		if (entryFields) {
			bibtexStrParts.push(`@${entry.type}{${entry._id},`)

			for (const key in entryFields) {
				if (entryFields.hasOwnProperty(key)) {
					const value: FieldValue = entryFields[key];
					if (value) {
						const valueStr = normalizeFieldValue(value)
						let fieldName = key
						let fieldValue = valueStr
						fieldValueMap[fieldName] = (fieldValue && fieldValue.toString()) || ""
						bibtexStrParts.push(`  ${fieldName} = {${fieldValue}},`)
					}
				}
			}
			bibtexStrParts.push("}")
		}
	}
	let indexTitle = ""
	return {
		bibEntry: entry,
		bibtexStr: bibtexStrParts.join("\n"),
		fieldValueMap: fieldValueMap,
		indexTitle: indexTitle,
	}
}

function getBibEntry(
    bibFileData: string,
    citeKey?: string,
): {
		bibEntry: BibEntry | undefined,
		bibtexStr: string,
		fieldValueMap: { [key: string]: string },
		indexTitle: string,
}{
	bibFileData = cleanBibFileData(bibFileData);
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
	return postProcessBibEntry(entry);
}

async function generateAuthorLinks(
    app: App,
    configuration: BibliosidianConfiguration,
    args: BibTexModalArgs,
    entry: BibEntry,
    entryTitle: string,
    creatorSets: Authors[],
): Promise<{
    filePath: string;
    displayName: string;
    bareLink: string;
    aliasedLink: string;
}[]> {
    let results: {
        filePath: string;
        displayName: string;
        bareLink: string;
        aliasedLink: string;
    }[] = [];
    if (!entry) {
        return results;
    }

    // Process all creators sequentially
    for (const creator of creatorSets) {
        let authorLastNames: string[] = [];
        const updateDate = new Date();
        const updateDateStamp: string = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}-${String(updateDate.getDate()).padStart(2, '0')}T${String(updateDate.getHours()).padStart(2, '0')}:${String(updateDate.getMinutes()).padStart(2, '0')}:${String(updateDate.getSeconds()).padStart(2, '0')}`;

        // Process all authors for this creator sequentially
        for (const author of creator.authors$) {
            let lastName = author?.lastNames ? author.lastNames.join(" ") : "";
            if (lastName) {
                authorLastNames.push(lastName);
            }
            const {
                displayName: authorDisplayName,
                normalizedFileName: authorFileName,
            } = composeAuthorData(author);

            let authorParentFolderPath: string;
            if (configuration.authorNoteConfiguration.isSubdirectorizeLexically) {
                authorParentFolderPath = _path.join(configuration.authorNoteConfiguration.parentFolderPath, authorFileName[0]);
            } else {
                authorParentFolderPath = configuration.authorNoteConfiguration.parentFolderPath;
            }
            const authorFilePath = _path.join(authorParentFolderPath, authorFileName);

            if (args.isCreateAuthorNotes && (configuration.authorNoteConfiguration.isAutoCreate ?? false)) {
                let targetFilepath = authorFilePath;
                if (!targetFilepath.endsWith(".md")) {
                    targetFilepath = targetFilepath + ".md";
                }
                await createOrOpenNote(
                    app,
                    targetFilepath,
                    false,
                    false,
                );

                let fileProperties = new FileProperties(app, targetFilepath);
                let authorProperties: FilePropertyData = {};
                authorProperties["tags"] = configuration.authorNoteConfiguration.tagMetadata.map( (s) => s.replace(/^#/,"") );
                // composeMetadata(
                //     fileProperties,
                //     authorProperties,
                //     configuration.authorNoteConfiguration.frontmatterMetadata,
                //     true,
                // )
                authorProperties["date-modified"] = fileProperties.concatItems("date-modified", [updateDateStamp]);
                authorProperties["title"] = authorDisplayName;
                authorProperties["aliases"] = fileProperties.concatItems("aliases", [authorDisplayName]);
                let sourceLink = `[[${args.targetFilepath.replace(/\.md$/, "")}|${entryTitle}]]`;
                let refPropName = configuration.authorNoteConfiguration.frontmatterPropertyNamePrefix + configuration.biblioNoteConfiguration.associatedNotesOutlinkPropertyName;
                authorProperties[refPropName] = fileProperties.concatItems(refPropName, [sourceLink]);

                await updateFrontMatter(
                    app,
                    targetFilepath,
                    authorProperties,
                    true,
                );
            }

            results.push({
                filePath: authorFilePath,
                displayName: authorDisplayName,
                bareLink: `[[${authorFilePath}]]`,
                aliasedLink: `[[${authorFilePath}|${authorDisplayName}]]`,
            });
        }
    }

    return results;
}

// function composeMetadata(
//     fileProperties: FileProperties,
//     refProperties: FilePropertyData,
//     additionalMetadata: FilePropertyData,
//     isReplace: boolean,
// ): FilePropertyData {
//     if (!additionalMetadata) {
//         return refProperties;
//     }
//     // return refProperties;
//     if (isReplace) {
//         refProperties = {
//             ... refProperties,
//             ... additionalMetadata,
//         }
//     } else {
//         for (const propertyKey of Object.keys(additionalMetadata)) {
//             let propertyValue = additionalMetadata[propertyKey];
//             if (Array.isArray(propertyValue)) {
//                 refProperties[propertyKey] = fileProperties.concatItems(
//                     propertyKey,
//                     propertyValue,
//                 )
//             } else {
//                 refProperties[propertyKey] = propertyValue;
//             }
//         }
//     }
//     return refProperties;
// }

async function generateBiblioNote(
	app: App,
	configuration: BibliosidianConfiguration,
	args: BibTexModalArgs,
	citeKey?: string,
) {
	if (!args.targetFilepath || args.targetFilepath.startsWith(".") || args.targetFilepath === ".md") {
		return
	}
	await createOrOpenNote(
		this.app,
		args.targetFilepath,
		args.isOpenNote,
		false,
	)
    await generateSourceFrontmatter(
        app,
        configuration,
        args,
        citeKey,
    )
}

function computeBibEntryTargetFilePath(
	bibEntry: BibEntry,
	configuration: BibliosidianConfiguration,
): string {
	let citationKey = bibEntry._id;
	let citekeyMarkedUp = `@${citationKey}`;
	let parentPath = configuration.biblioNoteConfiguration.parentFolderPath;
	if (configuration.biblioNoteConfiguration.isSubdirectorizeLexically) {
		parentPath = _path.join(parentPath, replaceProblematicChars(citationKey[0]))
	}
	return _path.join(parentPath, citekeyMarkedUp + ".md")
}

function replaceProblematicChars(input: string): string {
    const regex = /[:*?"<>|\/\\]/g;
    return input.replace(regex, "0");
}

export type ProcessedBibTexResult = {
    successful: boolean,
    citeKey: string,
    citation: string,
    title: string,
    filePath: string,
    linkFilePath: string,
    fileLink: string,
    // formattedItem: string,
}

export async function generateBiblioNoteLibrary(
    app: App,
    bibFileData: string,
    configuration: BibliosidianConfiguration,
): Promise<ProcessedBibTexResult[]> {
    let processedResults: ProcessedBibTexResult[] = [];
    bibFileData = cleanBibFileData(bibFileData);
    try {
        const bibFile: BibFilePresenter = parseBibFile(bibFileData);
        // Replace forEach with for...of to properly handle async operations
        for (const citeKey of Object.keys(bibFile.entries$)) {
            let entry: BibEntry = bibFile.entries$[citeKey];
            let compositeTitle = resolveBibtexTitle(entry);
            let result: ProcessedBibTexResult = {
                successful: false,
                citeKey: citeKey,
                citation: `[@${citeKey}]`,
                title: compositeTitle,
                filePath: "",
                linkFilePath: "",
                fileLink: "",
                // formattedItem: "",
            };
            processedResults.push(result);
            let processedBibTex = postProcessBibEntry(entry);
            if (processedBibTex.bibEntry) {
                let filePath = computeBibEntryTargetFilePath(
                    processedBibTex.bibEntry,
                    configuration,
                )
                await generateBiblioNote(
                    app,
                    configuration,
                    {
                        sourceBibTex: processedBibTex.bibtexStr,
                        targetFilepath: filePath,
                        isCreateAuthorNotes: true,
                        isOpenNote: false,
                    },
                    citeKey,
                );
                result.successful = true;
                result.filePath = filePath;
                result.linkFilePath = filePath.replace(/\.md$/,'');
                result.fileLink = `[[${result.linkFilePath}]]`;
                // result.formattedItem = `- [@${citeKey}]: *[[${linkFilePath}|${compositeTitle}]]*.`;
                // result.formattedItem = `- [@${citeKey}]: *${compositeTitle}*.`;
            }
        }
    } catch (error) {
        console.error(error);
        new Notice(`BibTex parsing error:\n\n${error}`);
    }
    return processedResults;
}

// export async function createBiblioNote(
//     app: App,
//     configuration: BibliosidianConfiguration,
//     defaultBibTex: string,
//     targetFilepath: string,
//     citeKey?: string,
//     isOpenNote: boolean = true,
// ): Promise<void> {
//     const bibtexModal = new BibTexModal(
//         app,
//         configuration,
//         async (updatedArgs: BibTexModalArgs) => {
//             await generateBiblioNote(
//                 app,
//                 configuration,
//                 updatedArgs,
//                 undefined,
//             );
//         },
//         {
//             sourceBibTex: defaultBibTex,
//             targetFilepath: targetFilepath,
//             isCreateAuthorNotes: true,
//             isOpenNote: isOpenNote,
//         },
//     );
//     bibtexModal.open();
// }


export function createKeyValueTable<T extends Record<string, any>>(
    containerEl: HTMLElement,
    keyValueData: T
): HTMLTableElement {
    if (!keyValueData || typeof keyValueData !== 'object') {
        throw new Error('Invalid keyValueData provided.');
    }

    // Create the table element
    const table = document.createElement('table');
    table.style.width = '100%';
    table.setAttribute('border', '1');

    // Create the header row
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const headerCell1 = headerRow.insertCell();
    headerCell1.textContent = 'Property';
    const headerCell2 = headerRow.insertCell();
    headerCell2.textContent = 'Value';

    // Create the body of the table
    const tbody = table.createTBody();

    // Iterate over keyValueData and create rows
    for (const key in keyValueData) {
        if (keyValueData.hasOwnProperty(key)) {
            const row = tbody.insertRow();
            const cell1 = row.insertCell();
            cell1.textContent = key;
            const cell2 = row.insertCell();
            const value = keyValueData[key];

            // Handle different types of values
            cell2.textContent = (typeof value === 'object') ? JSON.stringify(value) : value;
        }
    }

    // Append the table to the container element
    containerEl.appendChild(table);

    // Return the table element
    return table;
}
