import {
	App,
	TFile,
	CachedMetadata,
	// Editor,
	// MarkdownView,
	// Modal,
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


export class FileProperties {
	app: App
	filePath: string;
	sourceFile: TFile
	private metadataCache: CachedMetadata

	constructor(
		app: App,
		filePath: string,
	) {
		this.app = app
		this.filePath = filePath;
		this.sourceFile = app.vault.getAbstractFileByPath(filePath) as TFile
		if (this.sourceFile && this.sourceFile.path) {
			this.metadataCache = app.metadataCache.getFileCache(this.sourceFile) || {}
		} else {
			this.metadataCache = {}
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

export async function updateFileProperties(
    app: App,
    filePath: string,
    propertyValueMap: FilePropertyData,
    newBodyLines: string[],
    isClearEmpty: boolean = true,
) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
        console.error("File not found");
        return;
    }

    let currentContent = await app.vault.read(file);
    let parsedFrontmatter: FilePropertyData = {};
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const frontMatterMatch = currentContent.match(frontmatterRegex);

    if (frontMatterMatch) {
        let frontmatter = frontMatterMatch[1];
        try {
            parsedFrontmatter = { ...parseYaml(frontmatter) };
        } catch (err) {
            console.log(err);
            console.log(frontmatter);
            new Notice(`Malformed existing YAML frontmatter in file '${filePath}': ${err}`);
            return;
        }
    }

    // Handle each property, merging arrays appropriately
    Object.entries(propertyValueMap).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            if (isClearEmpty && parsedFrontmatter[key]) {
                delete parsedFrontmatter[key];
            }
        } else {
            // If both existing and new values are arrays, concatenate them
            if (Array.isArray(value) && Array.isArray(parsedFrontmatter[key])) {
                // Create a Set to remove duplicates, then convert back to array
                parsedFrontmatter[key] = Array.from(new Set([
                    ...parsedFrontmatter[key],
                    ...value
                ]));
            } else if (Array.isArray(value) && parsedFrontmatter[key]) {
                // If new value is array but existing is single value, combine them
                parsedFrontmatter[key] = Array.from(new Set([
                    parsedFrontmatter[key],
                    ...value
                ]));
            } else if (Array.isArray(parsedFrontmatter[key]) && !Array.isArray(value)) {
                // If existing value is array but new is single value, append it
                parsedFrontmatter[key] = Array.from(new Set([
                    ...parsedFrontmatter[key],
                    value
                ]));
            } else {
                // For non-array values or when no existing value, just set it
                parsedFrontmatter[key] = value;
            }
        }
    });

    let newFrontmatterStr: string = `---\n${stringifyYaml(
        parsedFrontmatter,
        {
            doubleQuotedMinMultiLineLength: 900000,
            lineWidth: 0,
        }
    ).trim()}\n---`;

    let newContentLines: string[] = [
        newFrontmatterStr,
        ...newBodyLines,
        frontMatterMatch ? currentContent.replace(frontmatterRegex, "") : currentContent,
    ];

    await app.vault.modify(file, newContentLines.join("\n"));
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

