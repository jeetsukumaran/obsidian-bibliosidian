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
export class MoveFileModal extends Modal {
    private sourcePath: TextAreaComponent;
    private destinationPath: TextAreaComponent;
    private defaultDestinationPath: string;
    private fileSuggestModal: FileSuggestModal;

    constructor(app: App, defaultDestinationPath: string, files: TFile[]) {
        super(app);
        this.defaultDestinationPath = defaultDestinationPath;
        this.fileSuggestModal = new FileSuggestModal(app, files, (file: TFile) => {
            this.sourcePath.setValue(file.path);
        });
    }

    onOpen() {
        const {contentEl} = this;

        contentEl.createEl('h2', {text: 'Move File'});

        // Source file path setting
        new Setting(contentEl)
            .setName('Source File Path')
            .addTextArea(text => {
                this.sourcePath = text;
                text.setPlaceholder('Enter source file path');
            })
            .addButton(btn => btn
                .setButtonText('Browse')
                .onClick(() => this.fileSuggestModal.open()));

        // Destination file path setting
        new Setting(contentEl)
            .setName('Destination File Path')
            .addTextArea(text => {
                this.destinationPath = text;
                text.setValue(this.defaultDestinationPath);
            });

        // Reset button
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Reset')
                .onClick(() => {
                    this.destinationPath.setValue(this.defaultDestinationPath);
                }));

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


