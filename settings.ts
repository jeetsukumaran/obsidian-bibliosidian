import {
	FilePropertyData,
	parseYaml,
	stringifyYaml,
	createFilePropertyDataTable,
} from "./fileProperties";

import * as _path from "path";

export interface BibliosidianSettings {
	mySetting: string;
	referenceSourcePropertiesPrefix: string;
	referenceSourceBibTex: string;
	referenceSubdirectoryRoot: string;
	isSubdirectorizeReferencesLexically: boolean
	referenceAdditionalMetadata: FilePropertyData;
	authorsParentFolderPath: string;
	isSubdirectorizeAuthorsLexically: boolean;
	authorsAdditionalMetadata: FilePropertyData;
	isCreateAuthorPages: boolean;
	holdingsSubdirectoryRoot: string;
    holdingsPropertyName: string;
}

export const DEFAULT_SETTINGS: Partial<BibliosidianSettings> = {
	mySetting: 'default',
	referenceSourcePropertiesPrefix: "source-",
	referenceSourceBibTex: "entry-bibtex",
	referenceSubdirectoryRoot: _path.join("sources", "references"),
	isSubdirectorizeReferencesLexically: true,
	referenceAdditionalMetadata: {},
	authorsParentFolderPath: _path.join("sources", "authors"),
	isSubdirectorizeAuthorsLexically: true,
	isCreateAuthorPages: true,
	authorsAdditionalMetadata: {},
	holdingsSubdirectoryRoot: _path.join("sources", "holdings"),
    holdingsPropertyName: "source-holdings",
}

