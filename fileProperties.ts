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


type FrontmatterData = {
    [key: string]: any;
};

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

		let parsedFrontmatter: FrontmatterData = {};
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
        let newFrontmatterStr: string = YAML.stringify(parsedFrontmatter)

        if (frontMatterMatch) {
			content = content.replace(frontmatterRegex, `---\n${newFrontmatterStr}\n---`);
		} else {
			content = newFrontmatterStr + "\n" + content
		}
        await app.vault.modify(file, content);
    } else {
        console.error("File not found");
    }
}

