import {
	FilePropertyData,
	parseYaml,
	stringifyYaml,
	createFilePropertyDataTable,
} from "./fileProperties";


import * as _path from "path";

export type NoteConfiguration = {
    className: string;
    description: string;
    parentFolderPath: string;
	isSubdirectorizeLexically: boolean;
	namePrefix: string;
	namePostfix: string;
	returnLinkPropertyName: string;
    tagMetadata: string[];
	frontmatterMetadata: FilePropertyData;
	isAutoCreate: boolean;
}

export class BibliosidianSettings {

    bibliosidianPropertyNamespace: string;

	biblioNoteSourcePropertiesPrefix: string;
	biblioNoteSourceBibTex: string;
	biblioNoteParentFolder: string;
	isSubdirectorizeBiblioNotesLexically: boolean
    biblioNoteTagMetadata: string[];
	biblioNoteAdditionalMetadata: FilePropertyData;

	authorNoteParentFolderPath: string;
	isSubdirectorizeAuthorNotesLexically: boolean;
	authorBiblioNoteOutlinkPropertyName: string;
    authorNoteTagMetadata: string[];
	authorNoteAdditionalMetadata: FilePropertyData;
	isCreateAuthorNotes: boolean;

	associatedNotes: NoteConfiguration[];

	holdingsParentFolder: string;
    holdingsPropertyName: string;

    citationOutlinkPropertyNames: string[];
    citationInlinkPropertyNames: string[];
    citationKeyPropertyNames: string[];
    citationKeyPrefix: string;
    citationKeyPostfix: string;

    composePropertyKey(propertyName: string) {
        return `${this.biblioNoteSourcePropertiesPrefix}${propertyName}`;
    }
}

export const DEFAULT_SETTINGS: Partial<BibliosidianSettings> = {

	biblioNoteSourcePropertiesPrefix: "reference-",
	biblioNoteSourceBibTex: "reference-bibtex",
	biblioNoteParentFolder: _path.join("sources", "references"),
	isSubdirectorizeBiblioNotesLexically: true,
    biblioNoteTagMetadata: [],
	biblioNoteAdditionalMetadata: {},

	authorNoteParentFolderPath: _path.join("sources", "authors"),
	isSubdirectorizeAuthorNotesLexically: true,
    authorBiblioNoteOutlinkPropertyName: "source-references",
    authorNoteTagMetadata: [],
	authorNoteAdditionalMetadata: {},
	isCreateAuthorNotes: true,

    associatedNotes: [
        {
            className: "Extract",
            description: "Extracts, quotes, snippets, verbatim transcriptions, tables, figures or diagrams etc. from sources.",
            parentFolderPath: "sources/extracts",
            namePrefix: "",
            namePostfix: "_extract",
            isSubdirectorizeLexically: true,
            returnLinkPropertyName: "source-references",
            tagMetadata: [],
            frontmatterMetadata: {},
            isAutoCreate: false,
        },
        {
            className: "Outline",
            description: "Outlines, table of contents, guides to the organization of contents of sources.",
            parentFolderPath: "sources/outlines",
            namePrefix: "",
            namePostfix: "_outline",
            isSubdirectorizeLexically: true,
            returnLinkPropertyName: "source-references",
            tagMetadata: [],
            frontmatterMetadata: {},
            isAutoCreate: false,
        },
        {
            className: "Reading",
            description: "Notes on your readings, analyses, or processing of sources.",
            parentFolderPath: "journals/readings",
            namePrefix: "",
            namePostfix: "_reading",
            isSubdirectorizeLexically: true,
            returnLinkPropertyName: "source-references",
            tagMetadata: [],
            frontmatterMetadata: {},
            isAutoCreate: false,
        },
    ],

	holdingsParentFolder: _path.join("sources", "holdings"),
    holdingsPropertyName: "reference-holdings",

    citationOutlinkPropertyNames: [
        "references",
        "bibliography",
    ],
    citationInlinkPropertyNames: [
        "collections",
        "bibliographies",
    ],
    citationKeyPropertyNames: [
        "citekey",
        "citation-key",
        "source-citekey",
        "citationKey",
    ],
    citationKeyPrefix: "[@",
    citationKeyPostfix: "]",
}

