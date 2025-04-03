import {
	App,
	TFile,
	CachedMetadata,
	// Editor,
	// MarkdownView,
	// Modal,
	normalizePath,
	Notice,
	// Plugin,
	// PluginSettingTab,
	// Setting,
	// WorkspaceLeaf,
	// setIcon,
} from 'obsidian';


// npm install yaml
const {
	parse: parseYaml,
	stringify: stringifyYaml
} = require('yaml')
export {
	parseYaml,
	stringifyYaml,
};

export type FilePropertyData = {
    [key: string]: any;
};


export function getMetadataCache(app: App, filePath: string): CachedMetadata {
    const sourceFile = app.vault.getAbstractFileByPath(filePath) as TFile
    return app.metadataCache.getFileCache(sourceFile) || {};
}

export function readPropertyDict(app: App, filePath: string, key: string): FilePropertyData {
    const cachedMetadata = getMetadataCache(app, filePath);
    const data = cachedMetadata?.frontmatter?.[key]
    return data || {};
}

export class FileProperties {
	app: App
	filePath: string;
	sourceFile: TFile
	// private metadataCache: CachedMetadata

	constructor(
		app: App,
		filePath: string,
	) {
		this.app = app
		this.filePath = filePath;
		this.sourceFile = app.vault.getAbstractFileByPath(filePath) as TFile
        // if (this.sourceFile && this.sourceFile.path) {
        //     this.metadataCache = app.metadataCache.getFileCache(this.sourceFile) || {}
        // } else {
        //     this.metadataCache = {}
        // }
	}

	get metadataCache(): CachedMetadata {
		if (this.sourceFile && this.sourceFile.path) {
			return app.metadataCache.getFileCache(this.sourceFile) || {};
		} else {
			return {};
		}
	}

	readPropertyString(
		key: string,
		defaultValue?: string
	): string {
		if (!this.metadataCache?.frontmatter?.[key]) {
			return defaultValue || defaultValue || ""
		}
		let propertyValue = this.metadataCache?.frontmatter?.[key] || ""
		if (Array.isArray(propertyValue)) {
			return propertyValue.join("")
		} else {
			return propertyValue.toString()
		}
	}

	readPropertyList(
		key: string,
		defaultValue?: string[],
	): string[] {
		if (!this.metadataCache?.frontmatter?.[key]) {
			return defaultValue || []
		}
		let propertyValue = this.metadataCache?.frontmatter?.[key] || ""
		if (!propertyValue) {
			return []
		}
		if (Array.isArray(propertyValue)) {
			return propertyValue
		} else {
			return [propertyValue.toString()]
		}
	}

    resolveFirstMatchingPropertyValue(
		propertyNameList: string[],
		defaultValue: string = "",
    ): string {

        // return propertyNameList
        //         .map(propertyName => this.readPropertyString(propertyName))
        //         .find(propertyValue => propertyValue) ?? defaultValue;

        // return propertyNameList
        //     .find(propertyName => {
        //         const value = this.readPropertyString(propertyName);
        //         return value ? ((defaultValue = value), true) : false;
        //     }) ? defa

        for (const propertyName of propertyNameList) {
                const value = this.readPropertyString(propertyName);
                if (value) return value;
            }
        return defaultValue;
    }


	concatItems(
		propertyName: string,
		newItems: string[],
		isUnique: boolean = true,
		isSort: boolean = true,
	): string[] {
		let result: string[];
		if (isUnique) {
			result = Array.from(new Set([
				... this.readPropertyList(propertyName),
				... newItems
			]))
		} else {
			result = [ ... this.readPropertyList(propertyName), ... newItems]
		}
		if (isSort) {
			result = result.sort()
		}
		return result
	}
}

export function mergeProperties(
    originalProperties: FilePropertyData,
    newProperties: FilePropertyData,
    isClearEmpty: boolean = true,
) {
    // Merge properties, with special handling for arrays
    let mergedProperties = { ... originalProperties };
    for (const [key, newValue] of Object.entries(newProperties)) {
        if (newValue === null || newValue === undefined) {
            if (isClearEmpty && key in mergedProperties) {
                delete mergedProperties[key];
            }
            continue;
        }

        const existingValue = mergedProperties[key];

        if (Array.isArray(newValue)) {
            if (Array.isArray(existingValue)) {
                // Both are arrays - merge and deduplicate
                mergedProperties[key] = Array.from(new Set([...existingValue, ...newValue]));
            } else if (existingValue) {
                // Existing is scalar, new is array - combine into array
                mergedProperties[key] = Array.from(new Set([existingValue, ...newValue]));
            } else {
                // No existing value - use new array
                mergedProperties[key] = [...newValue];
            }
        } else if (Array.isArray(existingValue)) {
            // Existing is array, new is scalar - append to array
            mergedProperties[key] = Array.from(new Set([...existingValue, newValue]));
        } else {
            // Both are scalar values or no existing value
            mergedProperties[key] = newValue;
        }
    }
    return mergedProperties;
}

export async function updateFrontMatter(
    app: App,
    filePath: string,
    propertyValueMap: FilePropertyData,
    isClearEmpty: boolean = true,
    isAddUpdateNotice: boolean = false,
) {
    const file = app.vault.getAbstractFileByPath(normalizePath(filePath));
    if (!(file instanceof TFile)) {
        console.error("File not found to update front matter: " + filePath);
        return;
    }
    await app.fileManager.processFrontMatter(file, (frontmatter: { [key: string]: any }) => {
        // console.log(propertyValueMap);
        let mergedProperties = mergeProperties(frontmatter, propertyValueMap, isClearEmpty);
        // console.log(mergedProperties);
        Object.entries(mergedProperties).forEach(([propertyName, newValue]) => {
            frontmatter[propertyName] = newValue;
        });

        if (isAddUpdateNotice) {
            new Notice('Front matter updated.');
        }
    }).catch((error) => {
        new Notice(`Failed to update front matter: ${error.message}`);
    });
}

export function createFilePropertyDataTable(containerEl: HTMLElement, filePropertyData: FilePropertyData): HTMLTableElement {
    // Create the table element
    const table = document.createElement('table');
    table.style.width = '100%'; // Set table width or other styles as needed
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

    // Iterate over filePropertyData and create rows
    for (const key in filePropertyData) {
        if (filePropertyData.hasOwnProperty(key)) {
            const row = tbody.insertRow();
            const cell1 = row.insertCell();
            cell1.textContent = key;
            const cell2 = row.insertCell();
            cell2.textContent = filePropertyData[key];
        }
    }

    // Append the table to the container element
    containerEl.appendChild(table);

    // Return the table element
    return table;
}

