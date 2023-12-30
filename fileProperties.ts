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
// import YAML from "yaml";
const YAML = require('yaml')


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
				parsedFrontmatter = { ... YAML.parse(frontmatter) }
			} catch (err) {
				new Notice(
`Malformed existing YAML frontmatter in file '${filePath}':
${err}`
			)
				console.log(err)
				return
			}
        }

		propertyValueMap.forEach( (value: any, key: string) => {
			if ( !(value ?? undefined) ) {
				if (isClearEmpty) {
					if (parsedFrontmatter[key]) {
						delete parsedFrontmatter[key]
					}
				}
			} else {
				parsedFrontmatter[key] = value
			}
		})
		// parsedFrontmatter[propertyName] = newValues
        let newFrontmatterStr: string = `---\n${YAML.stringify(parsedFrontmatter)}\n---`

        if (frontMatterMatch) {
			content = content.replace(frontmatterRegex, newFrontmatterStr);
		} else {
			content = newFrontmatterStr + "\n" + content
		}
        await app.vault.modify(file, content);
    } else {
        console.error("File not found");
    }

	// let propertyName = bibToYamlLabelFn(bibTexField)
	// if (values) {
	// 	updateFrontmatterYaml(
	// 		app,
	// 		targetFilePath,
	// 		propertyName,
	// 		values,
	// 	)
	// } else {
	// 	// clear?
	// }
}

export async function updateFrontmatterYaml(
	app: App,
	filePath: string,
	propertyName: string,
	newValues: string | string[],
) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {

		// let frontmatter = app.metadataCache?.getFileCache(file)?.frontmatter
		// if (frontmatter) {
		// 	frontmatter["source-authors"] = "hello"
		// }
		// let frontMatter = this.metadataCache?.frontmatter


        let content = await app.vault.read(file);

		let parsedFrontmatter: FilePropertyData = {};
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const frontMatterMatch = content.match(frontmatterRegex);
        if (frontMatterMatch) {
            let frontmatter = frontMatterMatch[1];
			try {
				parsedFrontmatter = { ... YAML.parse(frontmatter) }
			} catch (err) {
				new Notice(`
Failed to parse YAML frontmatter from file '${filePath}':
${err}
			`)
				console.log(err)
				return
			}
        }

		parsedFrontmatter[propertyName] = newValues
        let newFrontmatterStr: string = `---\n${YAML.stringify(parsedFrontmatter)}\n---`

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

