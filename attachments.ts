import {
    App,
    Modal,
    Notice,
    Setting,
    FuzzySuggestModal,
    TFile,
    TextAreaComponent,
    FileSystemAdapter,
} from 'obsidian';

import * as _path from "path";
import * as fs from 'fs';
import { promisify } from 'util';

const copyFile = promisify(fs.copyFile);
async function copyFileAsync(source: string, destination: string): Promise<void> {
    try {
        await copyFile(source, destination);
        console.log(`File copied from ${source} to ${destination}`);
    } catch (error) {
        console.error('Error occurred:', error);
    }
}


import {
    ensureParentDirectoryExists,
    ensureUniquePath,
    formatAttachmentPath,
} from "./utility";

// File Suggest Modal
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

// Move File Modal
interface CustomFile extends File {
    path: string;
}
export class MoveFileModal extends Modal {
    private sourcePath: HTMLTextAreaElement;
    private destinationPath: TextAreaComponent;
    private defaultDestinationFolder: string;

    constructor(
        app: App,
        defaultDestinationFolder: string,
    ) {
        super(app);
        this.defaultDestinationFolder = defaultDestinationFolder;
    }

    onOpen() {
        const {contentEl} = this;

        let activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }

		contentEl.createEl("h1", { text: "Add a reference holding" });

        // let sourceFilePathSetting = new Setting(contentEl)
        //     .setName('Source File Path')
        //     .addTextArea(text => {
        //         this.sourcePath = text;
        //         text.setPlaceholder('Enter source file path');
        //     })

        // let sourceFilePathTextArea = contentEl.createEl("textarea");
        // sourceFilePathTextArea.style.width = "100%";  // Set width to 100% of parent
        // sourceFilePathTextArea.style.boxSizing = "border-box";  // Ensure padding and borders are included in the width


        let spDiv = contentEl.createEl("div", {});
        // this.sourcePath = new TextAreaComponent(spDiv);
        // this.sourcePath.style.width = "100%";
        // let sourceFilePathTextArea = contentEl.createEl("textarea");
        // let sourceFilePathTextArea = spDiv;
        this.sourcePath = contentEl.createEl("textarea");
        let sourceFilePathTextArea = this.sourcePath;
        sourceFilePathTextArea.placeholder = 'Enter source file path';
        sourceFilePathTextArea.style.width = "100%";
        sourceFilePathTextArea.addEventListener('input', (event) => {
            const target = event.target as HTMLTextAreaElement;
            // this.sourcePath.setValue(target.value);
            this.sourcePath.value = target.value;
            // this.sourcePath.value = target.value
        });

		let browseDiv = contentEl.createEl("div", {});
        browseDiv.style.width = "100%";
        // browseDiv.style.textAlign = "right";
        let fileInput = browseDiv.createEl("input", {
            type: "file",
            attr: {
                // multiple: ""
            }
        });
        fileInput.addEventListener('change', (event) => {
            const input = event.target as HTMLInputElement;
            if (input.files && input.files.length > 0) {
                const file = input.files[0] as CustomFile;
                let sourceFilePath = file.path;
                // this.sourcePath.setValue(sourceFilePath);
                this.sourcePath.value = sourceFilePath
                formatAttachmentPath(
                    this.app,
                    activeFile as TFile,
                    file.path,
                    this.defaultDestinationFolder,
                )
                .then(formattedPath => {
                    // this.destinationPath.setValue(formattedPath);
                    this.destinationPath.setValue(formattedPath);
                })
                .catch(error => {
                    console.error("Error composing attachment path: ", error);
                });
            }
        });
		contentEl.createEl("br", {});

        // Destination file path setting
        new Setting(contentEl)
        .setName('Destination File Path')
        .addTextArea(text => {
            this.destinationPath = text;
            // text.setValue(this.defaultDestinationPath);
        });


        // Reset button
        // new Setting(contentEl)
        //     .addButton(btn => btn
        //         .setButtonText('Reset')
        //         .onClick(() => {
        //             this.destinationPath.setValue(this.defaultDestinationPath);
        //         }));

        // OK and Cancel buttons
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('OK')
                .onClick(() => {
                    this.moveFile();
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()));
    }

    // private async moveFile() {
    //     const sourceFile = this.app.vault.getAbstractFileByPath(this.sourcePath.value);
    //     if (sourceFile instanceof TFile) {
    //         let destinationPath: string = this.destinationPath.getValue().toString().trim();
    //         if (!destinationPath) {
    //             return;
    //         }
    //         try {
    //             await ensureParentDirectoryExists(this.app, destinationPath);
    //         } catch (error) {
    //             new Notice(`Error ensuring parent directory for destination '${destinationPath}': ` + error);
    //             console.log(error);
    //         }
    //         destinationPath = await ensureUniquePath(this.app, destinationPath);
    //         try {
    //             // await this.app.vault.rename(sourceFile, destinationPath);
    //             await this.app.fileManager.renameFile(sourceFile, destinationPath);
    //             new Notice(`File moved from '${sourceFile.path}' to '${destinationPath}'`);
    //         } catch (error) {
    //             new Notice(`Error moving '${sourceFile.path}' to '${destinationPath}': ` + error);
    //             console.log(error);
    //         }
    //     } else {
    //         new Notice('Source file does not exist.');
    //     }
    // }

    getVaultBasePath(): string {
        const adapter = app.vault.adapter;
        if (adapter instanceof FileSystemAdapter) {
        return adapter.getBasePath();
        }
        return "";
    }

    private async moveFile() {
        const sourceFilePath = _path.resolve(this.sourcePath.value.trim());
        let destinationPath = _path.resolve(_path.join(this.getVaultBasePath(), this.destinationPath.getValue().toString().trim()));
        // let destinationPath: string = this.destinationPath.getValue().toString().trim();
        if (!destinationPath) {
            return;
        }
        try {
            await ensureParentDirectoryExists(this.app, destinationPath);
        } catch (error) {
            new Notice(`Error ensuring parent directory for destination '${destinationPath}': ` + error);
            console.log(error);
        }
        destinationPath = await ensureUniquePath(this.app, destinationPath);
        try {
            // await this.app.vault.rename(sourceFile, destinationPath);
            // await this.app.fileManager.renameFile(sourceFile, destinationPath);
            await copyFileAsync(sourceFilePath, destinationPath);
            new Notice(`File moved from '${sourceFilePath}' to '${destinationPath}'`);
        } catch (error) {
            new Notice(`Error moving '${sourceFilePath}' to '${destinationPath}': ` + error);
            console.log(error);
        }
    }
}


