import {
    App,
    Modal,
    Notice,
    Setting,
    FuzzySuggestModal,
    TFile,
    TextAreaComponent
} from 'obsidian';

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
    private sourcePath: TextAreaComponent;
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

        // File browser for source file
        let fileInput = contentEl.createEl("input", {
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
                this.sourcePath.setValue(sourceFilePath);
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

        // Source file path setting
        new Setting(contentEl)
        .setName('Source File Path')
        .addTextArea(text => {
            this.sourcePath = text;
            text.setPlaceholder('Enter source file path');
        })

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

    private async moveFile() {
        const sourceFile = this.app.vault.getAbstractFileByPath(this.sourcePath.getValue());
        if (sourceFile instanceof TFile) {
            let destinationPath: string = this.destinationPath.getValue().toString().trim();
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
                await this.app.fileManager.renameFile(sourceFile, destinationPath);
                new Notice(`File moved from '${sourceFile.path}' to '${destinationPath}'`);
            } catch (error) {
                new Notice(`Error moving '${sourceFile.path}' to '${destinationPath}': ` + error);
                console.log(error);
            }
        } else {
            new Notice('Source file does not exist.');
        }
    }
}


