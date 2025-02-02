import {
	FilePropertyData,
	parseYaml,
	stringifyYaml,
	createFilePropertyDataTable,
} from "./fileProperties";

import * as _path from "path";

export interface BibliosidianSettings {


	biblioNoteSourcePropertiesPrefix: string;
	biblioNoteSourceBibTex: string;
	biblioNoteParentFolder: string;
	isSubdirectorizeBiblioNotesLexically: boolean
    biblioNoteTagMetadata: FilePropertyData;
	biblioNoteAdditionalMetadata: FilePropertyData;

	authorNoteParentFolderPath: string;
	isSubdirectorizeAuthorNotesLexically: boolean;
	authorBiblioNoteOutlinkPropertyName: string;
    authorNoteTagMetadata: FilePropertyData;
	authorNoteAdditionalMetadata: FilePropertyData;
	isCreateAuthorPages: boolean;

	holdingsParentFolder: string;
    holdingsPropertyName: string;

	readingNoteParentFolderPath: string;
	isSubdirectorizeReadingNotesLexically: boolean;
	readingNoteBiblioNoteOutlinkPropertyName: string;
    readingNoteNoteTagMetadata: FilePropertyData;
	readingNoteAdditionalMetadata: FilePropertyData;
	isCreateReadingNotePages: boolean;

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
    biblioNoteTagMetadata: {},
	biblioNoteAdditionalMetadata: {},

	authorNoteParentFolderPath: _path.join("sources", "authors"),
	isSubdirectorizeAuthorNotesLexically: true,
    authorBiblioNoteOutlinkPropertyName: "author-references",
    authorNoteTagMetadata: {},
	authorNoteAdditionalMetadata: {},
	isCreateAuthorPages: true,

	holdingsParentFolder: _path.join("sources", "holdings"),
    holdingsPropertyName: "reference-holdings",

	readingNoteParentFolderPath: _path.join("sources", "readingNote"),
	isSubdirectorizeReadingNotesLexically: true,
    readingNoteBiblioNoteOutlinkPropertyName: "author-references",
    readingNoteNoteTagMetadata: {},
	readingNoteAdditionalMetadata: {},
	isCreateReadingNotePages: true,

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

