import {
	FilePropertyData,
	parseYaml,
	stringifyYaml,
	createFilePropertyDataTable,
} from "./fileProperties";

import * as _path from "path";

export type AssociatedNoteSettings = {
    className: string;
    parentFolderPath: string;
	isSubdirectorizeLexically: boolean;
	returnLinkPropertyName: string;
    tagMetadata: string[];
	frontmatterMetadata: FilePropertyData;
	isAutoCreate: boolean;
}

export interface BibliosidianSettings {

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

	associatedNotes: AssociatedNoteSettings[];
	// extractNoteParentFolderPath: string;
	// isSubdirectorizeExtractNotesLexically: boolean;
	// extractNoteBiblioNoteOutlinkPropertyName: string;
    // extractNoteTagMetadata: FilePropertyData;
	// extractNoteAdditionalMetadata: FilePropertyData;
	// isCreateExtractNotes: boolean;

	// readingNoteParentFolderPath: string;
	// isSubdirectorizeReadingNotesLexically: boolean;
	// readingNoteBiblioNoteOutlinkPropertyName: string;
    // readingNoteTagMetadata: FilePropertyData;
	// readingNoteAdditionalMetadata: FilePropertyData;
	// isCreateReadingNotes: boolean;

	holdingsParentFolder: string;
    holdingsPropertyName: string;

    citationOutlinkPropertyNames: string[];
    citationInlinkPropertyNames: string[];
    citationKeyPropertyNames: string[];
    citationKeyPrefix: string;
    citationKeyPostfix: string;
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
            parentFolderPath: "sources/extracts",
            isSubdirectorizeLexically: true,
            returnLinkPropertyName: "source-references",
            tagMetadata: [],
            frontmatterMetadata: {},
            isAutoCreate: false,
        },
        {
            className: "Reading",
            parentFolderPath: "sources/readings",
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

