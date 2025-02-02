import {
	FilePropertyData,
	parseYaml,
	stringifyYaml,
	createFilePropertyDataTable,
} from "./fileProperties";

import * as _path from "path";

export interface BibliosidianSettings {
    biblioNoteTagMetadata: FilePropertyData;
    authorNoteTagMetadata: FilePropertyData;
	mySetting: string;
	biblioNoteSourcePropertiesPrefix: string;
	biblioNoteSourceBibTex: string;
	biblioNoteSubdirectoryRoot: string;
	isSubdirectorizeBiblioNotesLexically: boolean
	biblioNoteAdditionalMetadata: FilePropertyData;
	authorsParentFolderPath: string;
	isSubdirectorizeAuthorsLexically: boolean;
	authorBiblioNoteOutlinkPropertyName: string;
	authorsAdditionalMetadata: FilePropertyData;
	isCreateAuthorPages: boolean;
	holdingsSubdirectoryRoot: string;
    holdingsPropertyName: string;
	readingsSubdirectoryRoot: string;
    readingsPropertyName: string;
    citationOutlinkPropertyNames: string[];
    citationInlinkPropertyNames: string[];
    citationKeyPropertyNames: string[];
    citationKeyPrefix: string;
    citationKeyPostfix: string;
}

export const DEFAULT_SETTINGS: Partial<BibliosidianSettings> = {
    biblioNoteTagMetadata: {},
    authorNoteTagMetadata: {},
	mySetting: 'default',
	biblioNoteSourcePropertiesPrefix: "source-",
	biblioNoteSourceBibTex: "entry-bibtex",
	biblioNoteSubdirectoryRoot: _path.join("sources", "references"),
	isSubdirectorizeBiblioNotesLexically: true,
	biblioNoteAdditionalMetadata: {},
	authorsParentFolderPath: _path.join("sources", "authors"),
	isSubdirectorizeAuthorsLexically: true,
	isCreateAuthorPages: true,
	authorsAdditionalMetadata: {},
	holdingsSubdirectoryRoot: _path.join("sources", "holdings"),
    holdingsPropertyName: "source-holdings",
	readingsSubdirectoryRoot: _path.join("sources", "holdings"),
    readingsPropertyName: "source-holdings",
    authorBiblioNoteOutlinkPropertyName: "author-references",
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

