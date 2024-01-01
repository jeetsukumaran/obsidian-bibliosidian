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
	stringifyYaml
};


export type FilePropertyData = {
    [key: string]: any;
};

export async function updateFileProperties(
	app: App,
	filePath: string,
	propertyValueMap: FilePropertyData,
	isClearEmpty: boolean = true,
) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
        let content = await app.vault.read(file);
		let parsedFrontmatter: FilePropertyData = {};
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const frontMatterMatch = content.match(frontmatterRegex);
        if (frontMatterMatch) {
            let frontmatter = frontMatterMatch[1];
			try {
				parsedFrontmatter = { ... parseYaml(frontmatter) }
			} catch (err) {
				new Notice(
`Malformed existing YAML frontmatter in file '${filePath}':
${err}`
			)
				console.log(err)
				return
			}
        }

		Object.entries(propertyValueMap).forEach(([key, value]) => {
			if (!(value ?? undefined)) {
				if (isClearEmpty) {
					if (parsedFrontmatter[key]) {
						delete parsedFrontmatter[key];
					}
				}
			} else {
				parsedFrontmatter[key] = value;
			}
		});
		// parsedFrontmatter[propertyName] = newValues
        let newFrontmatterStr: string = `---\n${stringifyYaml(parsedFrontmatter).trim()}\n---`

        if (frontMatterMatch) {
			content = content.replace(frontmatterRegex, newFrontmatterStr);
		} else {
			content = newFrontmatterStr + "\n" + content
		}
        await app.vault.modify(file, content);
    } else {
        console.error("File not found");
    }
}
