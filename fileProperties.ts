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
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const frontMatterMatch = content.match(frontmatterRegex);
		let parsedFrontmatter = {};
        if (frontMatterMatch) {
            let frontmatter = frontMatterMatch[1];
			try {
				parsedFrontmatter = YAML.parse(frontmatter)
			} catch (err) {
				new Notice(`
Failed to parse YAML frontmatter from file '${filePath}':
${err}
			`)
				console.log(err)
				return
			}
        }
        let newFrontmatter: string = YAML.stringify(parsedFrontmatter)
        content = content.replace(frontmatterRegex, `---\n${newFrontmatter}\n---`);
        await app.vault.modify(file, content);
    } else {
        console.error("File not found");
    }
}

