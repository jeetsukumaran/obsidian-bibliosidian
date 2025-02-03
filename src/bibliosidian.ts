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
    createOrOpenNote,
} from "./utility";

import {
    composePropertyKey,
    BibliosidianSettings,
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
	settings: BibliosidianSettings,
	args: BibTexModalArgs,
    citeKey?: string,
) {

	// let bibToYamlLabelFn: (arg0:string) => string = (bibStr) => `${settings.biblioNoteSourcePropertiesPrefix}${bibStr}`

    let { bibEntry, bibtexStr, fieldValueMap } = getBibEntry(args.sourceBibTex, citeKey)

    if (!bibEntry) {
    	new Notice("Bibliographic note data could not be resolved")
    	return
    }

    let refProperties: FilePropertyData = {};

	let citationKey = bibEntry._id.toLowerCase();

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
            console.log(`Error creating author for value ${fieldValue}: ${error}`);
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
            console.log(`Error creating author for value ${fieldValue}: ${error}`);
            console.log(error);
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
	const updateDate = new Date();
	const updateDateStamp: string = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}-${String(updateDate.getDate()).padStart(2, '0')}T${String(updateDate.getHours()).padStart(2, '0')}:${String(updateDate.getMinutes()).padStart(2, '0')}:${String(updateDate.getSeconds()).padStart(2, '0')}`;

    composeMetadata(
        fileProperties,
        refProperties,
        settings.biblioNoteTagMetadata,
        false,
    )
    composeMetadata(
        fileProperties,
        refProperties,
        settings.biblioNoteAdditionalMetadata,
        true,
    )

	// let entryTitle = `${inTextCitation} *${compositeTitle}*`
	let unformattedEntryTitle = `${inTextCitation}: ${compositeTitle}`
	let abstract = cleanText( (bibEntry.getFieldAsString("abstract")?.toString() || "") )
	// let entryTitle = `(@${citationKey}) ${compositeTitle}`
    let internalLinkPath = args.targetFilepath.replace(/\.md$/, "");
    let basenameWithoutExtension: string = _path.basename(args.targetFilepath, ".md");
    let citationStrings: string[] = [
        `[@${citeKey}]: *[[${internalLinkPath}|${compositeTitle}]]*`,
        `@${citationKey}`,
        `[@${citationKey}]`,
        `[[@${citationKey}]]`,
        `${inTextCitation}`,
        `"[[${internalLinkPath}]]"`,
        `[[${internalLinkPath}|${unformattedEntryTitle}]]`,
        `[[${internalLinkPath}|@${citationKey}]]`,
    ];
    let quotedAbstractLines: string[] = [
        "> [!quote] Abstract",
        ">",
        `> > ${abstract ? abstract : '...'}`,
        ">",
        `> -- [@${citationKey}]: [[${internalLinkPath}|${compositeTitle}]]`,
        "",
    ]
    // special meta-metadata for bibliosidian management
    // console.log(settings);
    const entryUpdatedKey = composePropertyKey(settings, "entry-updated");
	refProperties[entryUpdatedKey] = fileProperties.concatItems(entryUpdatedKey, [updateDateStamp])

    const fa = getFieldAsStringArray(bibEntry, "file");
    refProperties[composePropertyKey(settings, "files")] = fa
    let refBibliographicalData: FilePropertyData = {};
    refProperties[composePropertyKey(settings, "data")] = refBibliographicalData;

    refBibliographicalData["citekey"] = citationKey;
    refBibliographicalData["cite-as"] = citationStrings;
    for (const [key, value] of Object.entries(creatorNames)) {
        if (!bibEntry) {
            continue;
        }
        let authorLinks = await generateAuthorLinks(
            app,
            settings,
            args,
            bibEntry,
            `${inTextCitation} ${compositeTitle}`,
            [value],
        );
        // let authorBareLinks = authorLinks.map((link) => link.bareLink);
        let refKey: string = key.endsWith("s") ? key : key + "s";
        refBibliographicalData[refKey] = authorLinks.map((link) => link.displayName);
        refProperties[composePropertyKey(settings, refKey)] = authorLinks.map((link) => link.aliasedLink);
    }

    refBibliographicalData["date"] = sourceYear
    refBibliographicalData["title"] = compositeTitle
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
	refBibliographicalData["bibtex"] = bibtexStr

	refProperties["aliases"] = [
			`@${citationKey}`,
			inTextCitation,
			compositeTitle,
			unformattedEntryTitle,
	]
	refProperties["title"] = `${inTextCitation}: ${compositeTitle}`
	if (abstract) {
		refProperties["abstract"] = abstract
	}
    // process attachments
    // refProperties[bibToYamlLabelFn("files")] = bibEntry.getFieldAsString("file")
    updateFrontMatter(
    	this.app,
    	args.targetFilepath,
        refProperties,
    	// refBodyLines,
    	true,
    )

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
    settings: BibliosidianSettings,
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
            if (settings.isSubdirectorizeAuthorNotesLexically) {
                authorParentFolderPath = _path.join(settings.authorNoteParentFolderPath, authorFileName[0]);
            } else {
                authorParentFolderPath = settings.authorNoteParentFolderPath;
            }
            const authorFilePath = _path.join(authorParentFolderPath, authorFileName);

            if (args.isCreateAuthorNotes) {
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
                // if (settings.authorNoteAdditionalMetadata) {
                //     authorProperties = { ...authorProperties, ...settings.authorNoteAdditionalMetadata };
                // }
                composeMetadata(
                    fileProperties,
                    authorProperties,
                    settings.authorNoteTagMetadata,
                    false,
                )
                composeMetadata(
                    fileProperties,
                    authorProperties,
                    settings.authorNoteAdditionalMetadata,
                    true,
                )
                authorProperties["entry-updated"] = fileProperties.concatItems("entry-updated", [updateDateStamp]);
                authorProperties["title"] = authorDisplayName;
                authorProperties["aliases"] = fileProperties.concatItems("aliases", [authorDisplayName]);
                let sourceLink = `[[${args.targetFilepath.replace(/\.md$/, "")}|${entryTitle}]]`;
                let refPropName = settings.authorBiblioNoteOutlinkPropertyName || "references";
                authorProperties[refPropName] = fileProperties.concatItems(refPropName, [sourceLink]);

                await updateFrontMatter(
                    app,
                    targetFilepath,
                    authorProperties,
                    // bodyLines,
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

function composeMetadata(
    fileProperties: FileProperties,
    refProperties: FilePropertyData,
    additionalMetadata: FilePropertyData,
    isReplace: boolean,
): FilePropertyData {
    if (!additionalMetadata) {
        return refProperties;
    }
    // return refProperties;
    if (isReplace) {
        refProperties = {
            ... refProperties,
            ... additionalMetadata,
        }
    } else {
        for (const propertyKey of Object.keys(additionalMetadata)) {
            let propertyValue = additionalMetadata[propertyKey];
            if (Array.isArray(propertyValue)) {
                refProperties[propertyKey] = fileProperties.concatItems(
                    propertyKey,
                    propertyValue,
                )
            } else {
                refProperties[propertyKey] = propertyValue;
            }
        }
    }
    return refProperties;
}

async function generateBiblioNote(
	app: App,
	settings: BibliosidianSettings,
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
        settings,
        args,
        citeKey,
    )
}

function computeBibEntryTargetFilePath(
	bibEntry: BibEntry,
	settings: BibliosidianSettings,
): string {
	let citationKey = bibEntry._id
	let citekeyMarkedUp = `@${citationKey}`
	let parentPath = settings.biblioNoteParentFolder
	if (settings.isSubdirectorizeBiblioNotesLexically) {
		parentPath = _path.join(parentPath, replaceProblematicChars(citationKey[0]))
	}
	return _path.join(parentPath, citekeyMarkedUp + ".md")
}

function replaceProblematicChars(input: string): string {
    const regex = /[:*?"<>|\/\\]/g;
    return input.replace(regex, "0");
}

class BibTexModal extends Modal {
    args: BibTexModalArgs;
	settings: BibliosidianSettings;
	parsedSourceTextAreaComponent: HTMLTextAreaElement;
	biblioNotePathTextComponent: HTMLTextAreaElement;
	isEnableBiblioNotePathAutoUpdate: boolean = true
	onGenerate: (args:BibTexModalArgs) => void;
	private _parsedBibEntry: BibEntry | undefined = undefined
	private _parsedBibTexStr: string = ""
	private _parsedFieldValueMap: { [key: string]: string } = {}

    constructor(
		app: App,
		settings: BibliosidianSettings,
		onGenerate: (arg0:BibTexModalArgs) => void,
		args: BibTexModalArgs,
    ) {
        super(app);
        this.settings = settings
        this.args = args;
        this.onGenerate = onGenerate
    }

	buildParsedTextAreaComponent(
		containerEl: HTMLElement,
		initialValue: string = "",
	) {
        let valuePlaceholder = (
`@article{kullback1951,
  title={On information and sufficiency},
  author={Kullback, Solomon and Leibler, Richard A},
  journal={The annals of mathematical statistics},
  volume={22},
  number={1},
  pages={79--86},
  year={1951},
}`
            )
        // containerEl.createEl("h3", { text: "BiblioNote BibTeX" })
        this.parsedSourceTextAreaComponent = containerEl.createEl("textarea");
        this.parsedSourceTextAreaComponent.placeholder = valuePlaceholder;
        this.parsedSourceTextAreaComponent.style.width = "100%";
        this.parsedSourceTextAreaComponent.style.height = "12rem";

        // containerEl.createEl("h3", { text: "BiblioNote data" })
        containerEl.createEl("br");
        let descEl = containerEl.createEl("div");
        descEl.style.width = "100%";
        descEl.style.marginBottom = "0.5rem";
        // descEl.style.height = "8rem";
        // descEl.style.border = "solid 1px";

        let parseUpdatedValue = () => {
            try {
                let inputValue: string = this.parsedSourceTextAreaComponent.value;
                descEl.empty()
                if (inputValue) {
                    // as of 2024-01-16, the parser doesn't handle `month = feb`,
                    // and lots of sources emit this
                    let result = getBibEntry(inputValue)
                    this._parsedBibEntry = result.bibEntry
                    this._parsedBibTexStr = result.bibtexStr
                    this._parsedFieldValueMap = result.fieldValueMap
                    createKeyValueTable(descEl, this._parsedFieldValueMap)
                    if (this.isEnableBiblioNotePathAutoUpdate) {
                        this.setBiblioNotePathTextComponentFromSource()
                    }
                } else {
                    this._parsedBibEntry = undefined
                    this._parsedBibTexStr = ""
                    this._parsedFieldValueMap = {}
                }
                // createFilePropertyDataTable(refPropertiesSetting.descEl, refProperties)
            } catch (error) {
                console.log(error);
                let messageStr = "Parse error: " + error.message;
                let messageNode = document.createTextNode(messageStr);
                descEl.empty()
                descEl.appendChild(messageNode);
            }
        }
        parseUpdatedValue()
        this.parsedSourceTextAreaComponent.addEventListener("blur", async () => {
            parseUpdatedValue()
        });

        let toolPanel = containerEl.createEl("div", { cls: ["model-input-support-panel"] })
        toolPanel.style.width = "100%";
        // toolPanel.style.textAlign = "left";
        let panelSetting = new Setting(toolPanel)
        panelSetting.controlEl.style.width = "100%";
        // panelSetting.controlEl.style.textAlign = "left";
        let resetButton = panelSetting.addButton( (button: ButtonComponent) => {
            button
            .setButtonText("Reset")
            .onClick( () => {
                this.parsedSourceTextAreaComponent.value = initialValue;
                parseUpdatedValue()
            });
        });


	}

	setBiblioNotePathTextComponentFromSource() {
		if (this._parsedBibEntry) {
			let filePath = computeBibEntryTargetFilePath(
				this._parsedBibEntry,
				this.settings,
			)
			this.biblioNotePathTextComponent.value = filePath;
		} else {
		}
	}

	renderBiblioNoteLocationInputTextArea(
		containerEl: HTMLElement,
		initialValue: string = "",
	) {

        this.biblioNotePathTextComponent = containerEl.createEl("textarea");
        this.biblioNotePathTextComponent.style.width = "100%";
        this.biblioNotePathTextComponent.style.height = "2rem";

		let toolPanel = containerEl.createEl("div", { cls: ["model-input-support-panel"] })
		let panelSetting = new Setting(toolPanel)

        panelSetting.controlEl.appendChild(document.createTextNode("Set from BibTeX"));
		panelSetting.addToggle( toggle => {
			toggle
				.setValue(this.isEnableBiblioNotePathAutoUpdate)
				.onChange(async (value) => {
					this.isEnableBiblioNotePathAutoUpdate = value;
				})
		});

        // panelSetting.controlEl.appendChild(document.createTextNode("Update authors"));
        // panelSetting.addToggle( toggle => {
        //     toggle
        //     .setValue(this.args.isCreateAuthorNotes)
        //     .onChange(async (value) => {
        //         this.args.isCreateAuthorNotes = value;
        //     })
        // });

		panelSetting.addButton( (button: ButtonComponent) => {
			button
			.setButtonText("Auto")
			.onClick( () => {
				this.setBiblioNotePathTextComponentFromSource()
			});
		});
		panelSetting.addButton( (button: ButtonComponent) => {
			button
			.setButtonText("Reset")
			.onClick( () => {
				this.biblioNotePathTextComponent.value = initialValue;
			});
		});
	}

    onOpen() {
        const { contentEl } = this;
		contentEl.createEl("h1", { text: "Create or update a bibliographic note" })

		contentEl.createEl("h2", { text: "Source BibTeX" });
		let biblioNoteSourceBibTexComponent = this.buildParsedTextAreaComponent(
			contentEl,
			this.args.sourceBibTex,
		);

		contentEl.createEl("h2", { text: "Destination bibliographic note path" })
		this.renderBiblioNoteLocationInputTextArea(
			contentEl,
			this.args.targetFilepath,
		);

		contentEl.createEl("h2", { text: "Author note(s)" })
		let updateAuthorsSettings = new Setting(contentEl)
		updateAuthorsSettings
			.setName("Update source author notes")
			.setDesc("Create or update notes for each author, adding links to bibliographic note and vice versa.")
			// .setDesc("Create or update biblioNote and associated author notes.")
		updateAuthorsSettings.addToggle( toggle => {
			toggle
				.setValue(this.args.isCreateAuthorNotes)
				.onChange(async (value) => {
					this.args.isCreateAuthorNotes = value;
				})
		})

		let execute = (isQuiet: boolean = true, isCopyLink = false) => {
			this.args.targetFilepath = this.biblioNotePathTextComponent.value.endsWith(".md") ? this.biblioNotePathTextComponent.value : this.biblioNotePathTextComponent.value + ".md"
			if (isCopyLink) {
                let citation: string = _path.basename(this.args.targetFilepath, ".md");
                if (!citation.startsWith("@")) {
                    citation = "@" + citation;
                }
                let clipText = `[${citation}]`;
                navigator.clipboard.writeText(clipText);
                // let basenameWithoutExtension: string = ....
                // let clipText = `[[${basenameWithoutExtension}]]`;
                // ... copy clipTextToClipboard
			}
			this.args.sourceBibTex = this.parsedSourceTextAreaComponent.value;
			this.onGenerate(this.args);
			if (!isQuiet) {
				new Notice(`Bibliographic note updated: '${this.args.targetFilepath}' `)
			}
			this.close();
		}

		let runUpdate = new Setting(contentEl)
			// .setName("Update")
		runUpdate
			.addButton( (button: ButtonComponent) => {
				button
				.setButtonText("Update")
				.onClick( () => {
					this.args.isOpenNote = false
					execute(false, false)
				});
			})
			.addButton( (button: ButtonComponent) => {
				button
				.setButtonText("Update and open")
				.onClick( () => {
					this.args.isOpenNote = true
					execute(true, false)
				});
			})
			.addButton( (button: ButtonComponent) => {
				button
				.setButtonText("Update and copy citation")
				.onClick( () => {
					this.args.isOpenNote = false
					execute(false, true)
				});
			})
			;


    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
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
    settings: BibliosidianSettings,
): Promise<ProcessedBibTexResult[]> {
    let processedResults: ProcessedBibTexResult[] = [];
    bibFileData = cleanBibFileData(bibFileData);
    try {
        const bibFile: BibFilePresenter = parseBibFile(bibFileData);
        // Replace forEach with for...of to properly handle async operations
        for (const citeKey of Object.keys(bibFile.entries$)) {
            let entry: BibEntry = bibFile.entries$[citeKey];
            // console.log(entry);
            // console.log(entry.title$);
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
                    settings,
                )
                await generateBiblioNote(
                    app,
                    settings,
                    {
                        sourceBibTex: processedBibTex.bibtexStr,
                        targetFilepath: filePath,
                        isCreateAuthorNotes: settings.isCreateAuthorNotes,
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
        console.log(error);
        new Notice(`BibTex parsing error:\n\n${error}`);
    }
    return processedResults;
}

export async function createBiblioNote(
    app: App,
    settings: BibliosidianSettings,
    defaultBibTex: string,
    targetFilepath: string,
    citeKey?: string,
    isOpenNote: boolean = true,
): Promise<void> {
    const bibtexModal = new BibTexModal(
        app,
        settings,
        async (updatedArgs: BibTexModalArgs) => {
            await generateBiblioNote(
                app,
                settings,
                updatedArgs,
                undefined,
            );
        },
        {
            sourceBibTex: defaultBibTex,
            targetFilepath: targetFilepath,
            isCreateAuthorNotes: settings.isCreateAuthorNotes, // settings gives default, args overrides
            isOpenNote: isOpenNote,
        },
    );
    bibtexModal.open();
}


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
