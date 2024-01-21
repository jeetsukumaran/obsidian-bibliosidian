import { App, Modal, Notice, Setting, FuzzySuggestModal, TFile, TextAreaComponent } from 'obsidian';

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
class MoveFileModal extends Modal {
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
            try {
                await this.app.vault.rename(sourceFile, this.destinationPath.getValue());
                new Notice('File moved successfully.');
            } catch (error) {
                new Notice('Error moving file: ' + error);
            }
        } else {
            new Notice('Source file does not exist.');
        }
    }
}

// Example usage
const files = app.vault.getFiles(); // Get all files in the vault
const modal = new MoveFileModal(app, 'default/destination/path', files);
modal.open();

