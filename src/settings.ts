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
    frontmatterPropertyNamePrefix: string;
	associatedNotesOutlinkPropertyName: string;
    tagMetadata: string[];
	frontmatterMetadata: FilePropertyData;
	isAutoCreate: boolean;
}

const BIBLIO_NOTE_KEY = "bibliographic"
const AUTHOR_NOTE_KEY = "author"
const CORE_NOTE_CONFIGURATIONS: { [key: string]: any } = {
    [BIBLIO_NOTE_KEY]: {
        className: "Bibliographic",
        description: "Primary reference notes to index sources and fundamental bibliographic data.",
        parentFolderPath: "sources/references",
        isSubdirectorizeLexically: true,
        namePrefix: "@",
        namePostfix: "",
        frontmatterPropertyNamePrefix: "reference-",
	    associatedNotesOutlinkPropertyName: "references",
        tagMetadata: [
            "#source/reference",
        ],
        frontmatterMetadata: {
        },
        isAutoCreate: true,
    },
    [AUTHOR_NOTE_KEY]: {
        className: "Author",
        description: "Notes to index and link authors across references.",
        parentFolderPath: "sources/authors",
        isSubdirectorizeLexically: true,
        namePrefix: "",
        namePostfix: "",
        frontmatterPropertyNamePrefix: "author-",
	    associatedNotesOutlinkPropertyName: "authors",
        tagMetadata: [
            "#source/author",
        ],
        frontmatterMetadata: {
        },
        isAutoCreate: true,
    },
};

export interface BibliosidianSettings {
    schemaVersion: string;
    coreNoteConfigurations: { [key: string]: NoteConfiguration };
	associatedNoteConfigurations: { [key: string]: NoteConfiguration };
	holdingsParentFolder: string;
    holdingsPropertyName: string;
    citationOutlinkPropertyNames: string[];
    citationInlinkPropertyNames: string[];
    citationKeyPropertyNames: string[];
    citationKeyPrefix: string;
    citationKeyPostfix: string;
}



export class BibliosidianConfiguration {
    settings: BibliosidianSettings;

    constructor(settings: BibliosidianSettings) {
        this.settings = settings;
        this.validateSettings();
    }

    validateSettings() {
        if (!this.settings.coreNoteConfigurations) {
            this.settings.coreNoteConfigurations = {}
        }
        if (!this.settings.coreNoteConfigurations[BIBLIO_NOTE_KEY]) {
            // JSON.parse(JSON.stringify(obj));
            this.settings.coreNoteConfigurations[BIBLIO_NOTE_KEY] = Object.assign({}, CORE_NOTE_CONFIGURATIONS[BIBLIO_NOTE_KEY] );
        }
    }

    get biblioNoteConfiguration(): NoteConfiguration {
        return this.getCoreNoteConfiguration(BIBLIO_NOTE_KEY);
    }

    get biblioNotePropertyNamePrefix(): string {
        return this.biblioNoteConfiguration.frontmatterPropertyNamePrefix;
    }

    composeBiblioNotePropertyName(name: string): string {
        return `${this.biblioNotePropertyNamePrefix}${name}`;
    }

    get biblioNoteDataPropertyName(): string {
        return `${this.composeBiblioNotePropertyName("data")}`;
    }


    get authorNoteConfiguration(): NoteConfiguration {
        return this.getCoreNoteConfiguration(AUTHOR_NOTE_KEY);
    }

    getCoreNoteConfiguration(key: string): NoteConfiguration {
        if (!this.settings.coreNoteConfigurations[key]) {
            // JSON.parse(JSON.stringify(obj));
            this.settings.coreNoteConfigurations[key] = Object.assign({}, CORE_NOTE_CONFIGURATIONS[key] );
        }
        return this.settings.coreNoteConfigurations[key]
    }

    getAssociatedNoteConfiguration(key: string): NoteConfiguration {
        return this.settings.associatedNoteConfigurations[key]
    }

    get holdingsParentFolder(): string {
        return this.settings.holdingsParentFolder ?? "";
    }

    get holdingsPropertyName(): string {
        return this.settings.holdingsPropertyName ?? "";
    }

    get citationOutlinkPropertyNames(): string[] {
        return this.settings.citationOutlinkPropertyNames ?? [];
    }

    get citationInlinkPropertyNames(): string[] {
        return this.settings.citationInlinkPropertyNames ?? [];
    }

    get citationKeyPropertyNames(): string[] {
        return this.settings.citationKeyPropertyNames ?? [];
    }

    get citationKeyPrefix(): string {
        return this.settings.citationKeyPrefix ?? "";
    }

    get citationKeyPostfix(): string {
        return this.settings.citationKeyPostfix ?? "";
    }


}

export const DEFAULT_SETTINGS: BibliosidianSettings = {

    schemaVersion: "1.0.0",
    coreNoteConfigurations: Object.assign({}, CORE_NOTE_CONFIGURATIONS),
    associatedNoteConfigurations: {
        "extract": {
            className: "Extract",
            description: "Extracts, quotes, snippets, verbatim transcriptions, tables, figures or diagrams etc. from sources.",
            parentFolderPath: "sources/extracts",
            isSubdirectorizeLexically: true,
            namePrefix: "",
            namePostfix: "_extract",
            frontmatterPropertyNamePrefix: "extract-",
            associatedNotesOutlinkPropertyName: "extracts",
            tagMetadata: [
                "#source/extract",
            ],
            frontmatterMetadata: {},
            isAutoCreate: false,
        },
        "outline": {
            className: "Outline",
            description: "Outlines, table of contents, guides to the organization of contents of sources.",
            parentFolderPath: "sources/outlines",
            isSubdirectorizeLexically: true,
            namePrefix: "",
            namePostfix: "_outline",
            frontmatterPropertyNamePrefix: "outline-",
            associatedNotesOutlinkPropertyName: "outlines",
            tagMetadata: [
                "#source/outline",
            ],
            frontmatterMetadata: {},
            isAutoCreate: false,
        },
        "reading": {
            className: "Reading",
            description: "Notes on your readings, analyses, or processing of sources.",
            parentFolderPath: "journals/readings",
            isSubdirectorizeLexically: true,
            namePrefix: "",
            namePostfix: "_reading",
            frontmatterPropertyNamePrefix: "reading-",
            associatedNotesOutlinkPropertyName: "readings",
            tagMetadata: [
                "#source/reading",
            ],
            frontmatterMetadata: {},
            isAutoCreate: false,
        },
    },

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

