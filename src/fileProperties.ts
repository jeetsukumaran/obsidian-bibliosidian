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

    // Read current content and parse frontmatter
    let currentContent = await app.vault.read(file);
    let parsedFrontmatter: FilePropertyData = {};
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const frontMatterMatch = currentContent.match(frontmatterRegex);

    if (frontMatterMatch) {
        try {
            parsedFrontmatter = parseYaml(frontMatterMatch[1]);
        } catch (err) {
            console.error(`Malformed YAML frontmatter in file '${filePath}':`, err);
            new Notice(`Malformed YAML frontmatter in file '${filePath}': ${err}`);
            return;
        }
    }

    // Deep clone the propertyValueMap to avoid reference issues
    const newProperties = JSON.parse(JSON.stringify(propertyValueMap));

    // Merge properties, with special handling for arrays
    for (const [key, newValue] of Object.entries(newProperties)) {
        if (newValue === null || newValue === undefined) {
            if (isClearEmpty && key in parsedFrontmatter) {
                delete parsedFrontmatter[key];
            }
            continue;
        }

        const existingValue = parsedFrontmatter[key];

        if (Array.isArray(newValue)) {
            if (Array.isArray(existingValue)) {
                // Both are arrays - merge and deduplicate
                parsedFrontmatter[key] = Array.from(new Set([...existingValue, ...newValue]));
            } else if (existingValue) {
                // Existing is scalar, new is array - combine into array
                parsedFrontmatter[key] = Array.from(new Set([existingValue, ...newValue]));
            } else {
                // No existing value - use new array
                parsedFrontmatter[key] = [...newValue];
            }
        } else if (Array.isArray(existingValue)) {
            // Existing is array, new is scalar - append to array
            parsedFrontmatter[key] = Array.from(new Set([...existingValue, newValue]));
        } else {
            // Both are scalar values or no existing value
            parsedFrontmatter[key] = newValue;
        }
    }

    // Generate new frontmatter
    const newFrontmatter = `---\n${stringifyYaml(parsedFrontmatter, {
        doubleQuotedMinMultiLineLength: 900000,
        lineWidth: 0,
    }).trim()}\n---`;

    // Combine content
    const currentBody = frontMatterMatch
        ? currentContent.replace(frontmatterRegex, '').trim()
        : currentContent.trim();

    const newContent = [
        newFrontmatter,
        ...newBodyLines,
        currentBody
    ].join('\n');

    // Update file
    await app.vault.modify(file, newContent);
}

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

export async function updateFrontMatterLists(
    app: App,
    file: TFile,
    propertyValueMap: FilePropertyData,
    isAddUpdateNotice: boolean = false,
) {
    await app.fileManager.processFrontMatter(file, (frontmatter: { [key: string]: any }) => {
        Object.entries(propertyValueMap).forEach(([propertyName, newValue]) => {
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

