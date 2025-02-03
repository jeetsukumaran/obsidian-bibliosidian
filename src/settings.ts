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

export interface BibliosidianConfigurationData {
    schemaVersion: string;
    coreNotes: NoteConfiguration[];
	associatedNotes: NoteConfiguration[];
}

export class BibliosidianSettings {

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
}

export class BibliosidianConfiguration {
    readonly settingsData: BibliosidianSettings;

    constructor(settingsData: BibliosidianSettings) {
        this.settingsData = settingsData;
    }

    get biblioNoteSourcePropertiesPrefix(): string {
        return this.settingsData.biblioNoteSourcePropertiesPrefix ?? "";
    }

    get biblioNoteSourceBibTex(): string {
        return this.settingsData.biblioNoteSourceBibTex ?? "";
    }

    get biblioNoteParentFolder(): string {
        return this.settingsData.biblioNoteParentFolder ?? "";
    }

    get isSubdirectorizeBiblioNotesLexically(): boolean {
        return this.settingsData.isSubdirectorizeBiblioNotesLexically ?? false;
    }

    get biblioNoteTagMetadata(): string[] {
        return this.settingsData.biblioNoteTagMetadata ?? [];
    }

    get biblioNoteAdditionalMetadata(): FilePropertyData {
        return this.settingsData.biblioNoteAdditionalMetadata;
    }

    get authorNoteParentFolderPath(): string {
        return this.settingsData.authorNoteParentFolderPath ?? "";
    }

    get isSubdirectorizeAuthorNotesLexically(): boolean {
        return this.settingsData.isSubdirectorizeAuthorNotesLexically ?? false;
    }

    get authorBiblioNoteOutlinkPropertyName(): string {
        return this.settingsData.authorBiblioNoteOutlinkPropertyName ?? "";
    }

    get authorNoteTagMetadata(): string[] {
        return this.settingsData.authorNoteTagMetadata ?? [];
    }

    get authorNoteAdditionalMetadata(): FilePropertyData {
        return this.settingsData.authorNoteAdditionalMetadata;
    }

    get isCreateAuthorNotes(): boolean {
        return this.settingsData.isCreateAuthorNotes ?? false;
    }

    get associatedNotes(): NoteConfiguration[] {
        return this.settingsData.associatedNotes ?? [];
    }

    get holdingsParentFolder(): string {
        return this.settingsData.holdingsParentFolder ?? "";
    }

    get holdingsPropertyName(): string {
        return this.settingsData.holdingsPropertyName ?? "";
    }

    get citationOutlinkPropertyNames(): string[] {
        return this.settingsData.citationOutlinkPropertyNames ?? [];
    }

    get citationInlinkPropertyNames(): string[] {
        return this.settingsData.citationInlinkPropertyNames ?? [];
    }

    get citationKeyPropertyNames(): string[] {
        return this.settingsData.citationKeyPropertyNames ?? [];
    }

    get citationKeyPrefix(): string {
        return this.settingsData.citationKeyPrefix ?? "";
    }

    get citationKeyPostfix(): string {
        return this.settingsData.citationKeyPostfix ?? "";
    }
}



export function composePropertyKey(settings: BibliosidianSettings, propertyName: string): string {
    return `${settings.biblioNoteSourcePropertiesPrefix}${propertyName}`;
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

