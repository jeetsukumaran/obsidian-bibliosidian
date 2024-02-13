import {
	FilePropertyData,
	parseYaml,
	stringifyYaml,
	createFilePropertyDataTable,
} from "./fileProperties";

import * as _path from "path";

export interface BibliosidianSettings {
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
    citationOutlinkPropertyNames: string[];
    citationInlinkPropertyNames: string[];
    citationKeyPropertyNames: string[];
    citationKeyPrefix: string;
    citationKeyPostfix: string;
}

export const DEFAULT_SETTINGS: Partial<BibliosidianSettings> = {
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

