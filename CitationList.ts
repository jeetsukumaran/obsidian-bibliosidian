import {
    App,
    Component,
    Editor,
    MarkdownView,
    Modal,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    TAbstractFile,
    WorkspaceLeaf,
    debounce,
    setIcon,
} from 'obsidian';

import {
    DataService,
    FileNodeDataType,
    FileNodeDataRecords,
} from "./DataService";

import {
	BibliosidianSettings,
    DEFAULT_SETTINGS,
} from "./settings";

export class CitationList {

    constructor(
        public hostFile: TFile,
        public dataService: DataService,
        public settings: BibliosidianSettings,
    ) {
    }


    generate(): string {
        let citations: string[] = [];
        let vaultFileRecords = this.dataService.refresh();
        vaultFileRecords.forEach( (fileData: FileNodeDataRecords) => {
            this.settings.citationInlinkPropertyNames.forEach( (propertyName: string) => {
                if (fileData[propertyName]) {
                    let propertyValues: FileNodeDataType[];
                    let pagePropertyValue = fileData[propertyName];
                    if (!Array.isArray(pagePropertyValue)) {
                        propertyValues = [ pagePropertyValue ];
                    } else {
                        propertyValues = [ ... pagePropertyValue ];
                    }
                    propertyValues.forEach( (value: FileNodeDataType) => {
                        if (value && value.path && value.path === this.hostFile.path) {
                            const citationKey: string = this.settings.citationKeyPropertyNames
                                .map(key => fileData[key]).find(value => value != null) || '';
                            citations.push(citationKey);
                        }
                    });
                }
            });
        });
        return citations.join("\n");
    }

}

