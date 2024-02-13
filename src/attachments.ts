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
	BibliosidianSettings,
    DEFAULT_SETTINGS,
} from "./settings";

import {
	FileProperties,
	FilePropertyData,
	updateFileProperties,
	// updateFrontmatterYaml,
} from "./fileProperties";

import {
    ensureDirectoryExists,
    ensureUniquePath,
    // formatAttachmentPath,
} from "./utility";

const copyFile = promisify(fs.copyFile);
async function copyFileAsync(source: string, destination: string): Promise<void> {
    try {
        await copyFile(source, destination);
        // console.log(`File copied from ${source} to ${destination}`);
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
    // private destinationPath: TextAreaComponent;
    private destinationPath: HTMLTextAreaElement;
    private defaultDestinationFolder: string;
    private settings: BibliosidianSettings;

    constructor(
        app: App,
        settings: BibliosidianSettings,
    ) {
        super(app);
        this.settings = settings;
        this.defaultDestinationFolder = this.settings.holdingsSubdirectoryRoot;
    }

    onOpen() {
        const {contentEl} = this;

        let activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }

		contentEl.createEl("h1", { text: "Import a holding" });
		contentEl.createEl("h2", { text: "Path to file to be imported" });
        this.sourcePath = contentEl.createEl("textarea");
        this.sourcePath.placeholder = "E.g., '/home/user/Downloads/papers/attachment.pdf'";
        this.sourcePath.style.width = "100%";
        // this.sourcePath.addEventListener('input', (event) => {
        //     const target = event.target as HTMLTextAreaElement;
        //     this.sourcePath.value = target.value;
        // });

		let browseDiv = contentEl.createEl("div", {});
        browseDiv.style.width = "100%";
        // browseDiv.style.textAlign = "right";
        let fileInput = browseDiv.createEl("input", {
            type: "file",
            attr: {
                // multiple: ""
            }
        });
        let sourcePathUpdatedFn = (sourceFilePath: string) => {
            let hostFilePath = (activeFile as TFile).path;
            // this.sourcePath.setValue(sourceFilePath);
            this.sourcePath.value = sourceFilePath;
            const destExtension = _path.extname(sourceFilePath);
            const hostFileNameWithoutExtension = _path.basename(
                hostFilePath,
                _path.extname(hostFilePath)
            );
            let destinationFilename = hostFileNameWithoutExtension + destExtension
            if (destinationFilename.startsWith("@")) {
                destinationFilename = destinationFilename.slice(1);
            }
            let parentPath = this.defaultDestinationFolder;
            if (this.settings.isSubdirectorizeBiblioNotesLexically) {
                let holdingSubDir = destinationFilename[0] === "@" ? destinationFilename[1] : destinationFilename[0];
                if (holdingSubDir === "@") {
                    holdingSubDir = hostFilePath[1];
                }
                parentPath = _path.join(parentPath, holdingSubDir)
            }
            let newFilePath = _path.join(
                parentPath,
                destinationFilename,
            );
            this.destinationPath.value = newFilePath;
        };
        this.sourcePath.addEventListener('input', (event) => {
            const target = event.target as HTMLTextAreaElement;
            this.sourcePath.value = target.value;
            sourcePathUpdatedFn(this.sourcePath.value);
        });
        fileInput.addEventListener('change', (event) => {
            const input = event.target as HTMLInputElement;
            if (input.files && input.files.length > 0) {
                const file = input.files[0] as CustomFile;
                let sourceFilePath = file.path;
                sourcePathUpdatedFn(file.path);
            }
        });
		contentEl.createEl("br", {});

		contentEl.createEl("h2", { text: "Path to destination" });
        this.destinationPath = contentEl.createEl("textarea");
        this.destinationPath.placeholder = "E.g., 'source/holdings'";
        this.destinationPath.style.width = "100%";
        this.destinationPath.addEventListener('input', (event) => {
            const target = event.target as HTMLTextAreaElement;
            this.destinationPath.value = target.value;
        });

        let runProcess = () => {
            this.updateHostFileHoldingsData(
                activeFile?.path || "",
                this.cleanDestinationPath
            );
        };
        new Setting(contentEl)
            // .addButton(btn => btn
            //     .setButtonText('Cancel')
            //     .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('Import')
                .onClick(() => {
                    this.importFile()
                        .then(runProcess);
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Import and Open')
                .onClick(() => {
                    this.importFile()
                        .then(() => {
                            runProcess();
                            let mode: PaneType | boolean = false;
                            app.workspace.openLinkText(
                                this.cleanDestinationPath,
                                '',
                                mode,
                            );
                            this.close();
                    });
                }));
    }

    updateHostFileHoldingsData(
        hostFilePath: string,
        newHoldingPath: string,
    ) {
        if (!hostFilePath) {
            return;
        }
        let fileProperties = new FileProperties(this.app, hostFilePath);
        let holdingsPropertyName = this.settings.holdingsPropertyName;
        let refProperties: FilePropertyData = {}
        let formattedNewHoldingPath = `[[${newHoldingPath}]]`;
        refProperties[holdingsPropertyName] = fileProperties.concatItems(holdingsPropertyName, [formattedNewHoldingPath])
        updateFileProperties(
            this.app,
            hostFilePath,
            refProperties,
            true,
        )
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
        let destinationPath = this.cleanDestinationPath;
        if (!destinationPath) {
            return;
        }
        try {
            await ensureDirectoryExists(
                this.app,
                _path.dirname(destinationPath),
            );
        } catch (error) {
            new Notice(`Error ensuring parent directory for destination '${destinationPath}': ` + error);
            console.log(destinationPath + ": " + error);
        }
        destinationPath = await ensureUniquePath(this.app, destinationPath);
        this.destinationPath.value = destinationPath; // update with unique path
        let fullDestinationPath = _path.join(this.getVaultBasePath(), destinationPath);
        try {
            // await this.app.vault.rename(sourceFile, destinationPath);
            // await this.app.fileManager.renameFile(sourceFile, destinationPath);
            await copyFileAsync(sourceFilePath, fullDestinationPath);
            new Notice(`File imported from '${sourceFilePath}' to '${destinationPath}'`);
        } catch (error) {
            new Notice(`Error moving '${sourceFilePath}' to '${destinationPath}': ` + error);
            console.log(error);
        }
    }
}


