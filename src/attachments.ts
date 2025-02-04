import {
    App,
    Modal,
    Notice,
    PaneType,
    Setting,
    FuzzySuggestModal,
    TFile,
    TextAreaComponent,
    FileSystemAdapter,
} from 'obsidian';

import * as _path from "path";
import * as fs from 'fs';
import { promisify } from 'util';

import {
	BibliosidianConfiguration,
} from "./settings";

import {
	FileProperties,
	FilePropertyData,
	updateFrontMatter,
} from "./fileProperties";

import {
    importHolding,
} from "./fileServices";

import {
    ensureDirectoryExists,
    ensureUniquePath,
    // formatAttachmentPath,
} from "./utility";

const copyFile = promisify(fs.copyFile);
const fileExists = promisify(fs.access);
async function copyFileAsync(source: string, destination: string): Promise<void> {
    try {
        await copyFile(source, destination);
    } catch (error) {
        // console.error('Error occurred:', error);
    }
}

class FileSuggestModal extends FuzzySuggestModal<TFile> {
    files: TFile[];
    onSelect: (file: TFile) => void;

    constructor(app: App, files: TFile[], onSelect: (file: TFile) => void) {
        super(app);
        this.files = files;
        this.onSelect = onSelect;
    }

    getItems(): TFile[] {
        return this.files;
    }

    getItemText(item: TFile): string {
        return item.path;
    }

    onChooseItem(item: TFile, _: MouseEvent | KeyboardEvent): void {
        this.onSelect(item);
    }
}

interface CustomFile extends File {
    path: string;
}

export class ImportHoldingModal extends Modal {
    private sourcePath: HTMLTextAreaElement;
    private destinationPath: HTMLTextAreaElement;
    private defaultDestinationFolder: string;
    private configuration: BibliosidianConfiguration;
    private activeFile: TFile | null;

    constructor(
        app: App,
        configuration: BibliosidianConfiguration,
    ) {
        super(app);
        this.configuration = configuration;
        this.defaultDestinationFolder = this.configuration.holdingsParentFolder;
        this.activeFile = null;
    }

    async getSourceFilesFromFrontmatter(): Promise<string[]> {
        if (!this.activeFile) {
            return [];
        }
        const fileProperties = new FileProperties(this.app, this.activeFile.path);
        return fileProperties.readPropertyList(`${this.configuration.biblioNoteConfiguration.frontmatterPropertyNamePrefix}files`);
    }

    async validateSourceFile(path: string): Promise<boolean> {
        try {
            await fileExists(path);
            return true;
        } catch {
            return false;
        }
    }

    async onOpen() {
        const {contentEl} = this;
        this.activeFile = this.app.workspace.getActiveFile();

        if (!this.activeFile) {
            new Notice("No active file selected");
            this.close();
            return;
        }

        // Get source files from frontmatter
        const sourceFiles = await this.getSourceFilesFromFrontmatter();
        const defaultSourcePath = sourceFiles.length > 0 ? sourceFiles[0] : '';

        contentEl.createEl("h1", { text: "Import a holding" });
        contentEl.createEl("h2", { text: "Path to file to be imported" });

        this.sourcePath = contentEl.createEl("textarea");
        this.sourcePath.value = defaultSourcePath;
        this.sourcePath.placeholder = "E.g., '/home/user/Downloads/papers/attachment.pdf'";
        this.sourcePath.style.width = "100%";

        let browseDiv = contentEl.createEl("div", {});
        browseDiv.style.width = "100%";

        let fileInput = browseDiv.createEl("input", {
            type: "file"
        });

        let sourcePathUpdatedFn = async (sourceFilePath: string) => {
            if (!this.activeFile) return;

            this.sourcePath.value = sourceFilePath;

            // Validate source file existence
            const sourceExists = await this.validateSourceFile(sourceFilePath);
            if (!sourceExists) {
                new Notice(`Source file does not exist: ${sourceFilePath}`);
                return;
            }

            const destExtension = _path.extname(sourceFilePath);
            const hostFileNameWithoutExtension = _path.basename(
                this.activeFile.path,
                _path.extname(this.activeFile.path)
            );

            let destinationFilename = hostFileNameWithoutExtension + destExtension;
            if (destinationFilename.startsWith("@")) {
                destinationFilename = destinationFilename.slice(1);
            }

            let parentPath = this.defaultDestinationFolder;
            if (this.configuration.biblioNoteConfiguration.isSubdirectorizeLexically) {
                let holdingSubDir = destinationFilename[0] === "@" ? destinationFilename[1] : destinationFilename[0];
                if (holdingSubDir === "@") {
                    holdingSubDir = this.activeFile.path[1];
                }
                parentPath = _path.join(parentPath, holdingSubDir);
            }

            let newFilePath = _path.join(
                parentPath,
                destinationFilename,
            );
            this.destinationPath.value = newFilePath;
        };

        // Set up event listeners
        this.sourcePath.addEventListener('input', async (event) => {
            const target = event.target as HTMLTextAreaElement;
            await sourcePathUpdatedFn(target.value);
        });

        fileInput.addEventListener('change', async (event) => {
            const input = event.target as HTMLInputElement;
            if (input.files && input.files.length > 0) {
                const file = input.files[0] as CustomFile;
                await sourcePathUpdatedFn(file.path);
            }
        });

        contentEl.createEl("br", {});

        contentEl.createEl("h2", { text: "Path to destination" });
        this.destinationPath = contentEl.createEl("textarea");
        this.destinationPath.placeholder = "E.g., 'source/holdings'";
        this.destinationPath.style.width = "100%";

        // If we have a default source path, trigger the update function
        if (defaultSourcePath) {
            await sourcePathUpdatedFn(defaultSourcePath);
        }

        // Set up import buttons
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Import')
                .onClick(async () => {
                    const sourceExists = await this.validateSourceFile(this.sourcePath.value.trim());
                    if (!sourceExists) {
                        new Notice(`Source file does not exist: ${this.sourcePath.value.trim()}`);
                        return;
                    }
                    await this.importFile();
                    updateHostFileHoldingsData(
                        this.app,
                        this.configuration,
                        this.activeFile?.path || "",
                        this.cleanDestinationPath
                    );
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Import and Open')
                .onClick(async () => {
                    const sourceExists = await this.validateSourceFile(this.sourcePath.value.trim());
                    if (!sourceExists) {
                        new Notice(`Source file does not exist: ${this.sourcePath.value.trim()}`);
                        return;
                    }
                    await this.importFile();
                    updateHostFileHoldingsData(
                        this.app,
                        this.configuration,
                        this.activeFile?.path || "",
                        this.cleanDestinationPath
                    );
                    let mode: PaneType | boolean = false;
                    this.app.workspace.openLinkText(
                        this.cleanDestinationPath,
                        '',
                        mode,
                    );
                    this.close();
                }));
    }

    getVaultBasePath(): string {
        const adapter = app.vault.adapter;
        if (adapter instanceof FileSystemAdapter) {
            return adapter.getBasePath();
        }
        return "";
    }

    get cleanDestinationPath() {
        // return this.destinationPath.getValue().toString().trim();
        return this.destinationPath.value.toString().trim();
    }

    private async importFile() {
        const sourceFilePath = _path.resolve(this.sourcePath.value.trim());

        if (!this.activeFile) {
            new Notice('No active file selected');
            return;
        }

        const result = await importHolding(
            this.app,
            this.configuration,
            this.activeFile.path,
            sourceFilePath
        );

        if (result.success) {
            this.destinationPath.value = result.destinationPath;
            new Notice(`File imported to '${result.destinationPath}'`);
        } else {
            new Notice(result.error || 'Import failed');
        }
    }

    // private async importFile() {
    //     const sourceFilePath = _path.resolve(this.sourcePath.value.trim());
    //     let destinationPath = this.cleanDestinationPath;
    //     if (!destinationPath) {
    //         return;
    //     }
    //     try {
    //         await ensureDirectoryExists(
    //             this.app,
    //             _path.dirname(destinationPath),
    //         );
    //     } catch (error) {
    //         new Notice(`Error ensuring parent directory for destination '${destinationPath}': ` + error);
    //         console.log(destinationPath + ": " + error);
    //     }
    //     destinationPath = await ensureUniquePath(this.app, destinationPath);
    //     this.destinationPath.value = destinationPath; // update with unique path
    //     let fullDestinationPath = _path.join(this.getVaultBasePath(), destinationPath);
    //     try {
    //         // await this.app.vault.rename(sourceFile, destinationPath);
    //         // await this.app.fileManager.renameFile(sourceFile, destinationPath);
    //         await copyFileAsync(sourceFilePath, fullDestinationPath);
    //         new Notice(`File imported from '${sourceFilePath}' to '${destinationPath}'`);
    //     } catch (error) {
    //         new Notice(`Error moving '${sourceFilePath}' to '${destinationPath}': ` + error);
    //         console.log(error);
    //     }
    // }
}




function updateHostFileHoldingsData(
    app: App,
    configuration: BibliosidianConfiguration,
    hostFilePath: string,
    newHoldingPath: string,
) {
    if (!hostFilePath) {
        return;
    }
    let fileProperties = new FileProperties(app, hostFilePath);
    let holdingsPropertyName = configuration.holdingsPropertyName;
    let refProperties: FilePropertyData = {}
    let formattedNewHoldingPath = `[[${newHoldingPath}]]`;
    refProperties[holdingsPropertyName] = fileProperties.concatItems(holdingsPropertyName, [formattedNewHoldingPath])
    updateFrontMatter(
        app,
        hostFilePath,
        refProperties,
        true,
    )
}
