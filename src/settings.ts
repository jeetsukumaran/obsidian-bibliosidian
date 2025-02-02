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
	biblioNoteSubdirectoryRoot: string;
	isSubdirectorizeBiblioNotesLexically: boolean
    biblioNoteTagMetadata: FilePropertyData;
	biblioNoteAdditionalMetadata: FilePropertyData;

	authorsParentFolderPath: string;
	isSubdirectorizeAuthorsLexically: boolean;
	authorBiblioNoteOutlinkPropertyName: string;
    authorNoteTagMetadata: FilePropertyData;
	authorsAdditionalMetadata: FilePropertyData;
	isCreateAuthorPages: boolean;

	holdingsSubdirectoryRoot: string;
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
	biblioNoteSubdirectoryRoot: _path.join("sources", "references"),
	isSubdirectorizeBiblioNotesLexically: true,
    biblioNoteTagMetadata: {},
	biblioNoteAdditionalMetadata: {},

	authorsParentFolderPath: _path.join("sources", "authors"),
	isSubdirectorizeAuthorsLexically: true,
    authorBiblioNoteOutlinkPropertyName: "author-references",
    authorNoteTagMetadata: {},
	authorsAdditionalMetadata: {},
	isCreateAuthorPages: true,

	holdingsSubdirectoryRoot: _path.join("sources", "holdings"),
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

