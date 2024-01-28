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


    formatCitationKey(citationKey: string): string {
        if (!citationKey) {
            return "";
        }
        return `- ${this.settings.citationKeyPrefix}${citationKey}${this.settings.citationKeyPostfix}`;
    }


    processCitationProperties(
        fileData: FileNodeDataType,
        propertyNames: string[],
        processFn: (propertyValue: FileNodeDataType) => void,
    ) {
        propertyNames.forEach( (propertyName: string) => {
            if (fileData[propertyName]) {
                let propertyValues: FileNodeDataType[];
                let pagePropertyValue = fileData[propertyName];
                if (!Array.isArray(pagePropertyValue)) {
                    propertyValues = [ pagePropertyValue ];
                } else {
                    propertyValues = [ ... pagePropertyValue ];
                }
                propertyValues.forEach( (value: FileNodeDataType) => {
                    if (value && value.path) { // a valid link item
                        processFn(value);
                    }
                    // if (filterFn(value)) {
                    //     const citationKey: string = this.settings.citationKeyPropertyNames
                    //     .map(key => fileData[key]).find(value => value != null) || '';
                    //     citations.push(this.formatCitationKey(citationKey));
                    // }

                });
            }
        });
    }

    extractCitationKey(fileData: FileNodeDataType) {
        const citationKey: string = this.settings.citationKeyPropertyNames
            // .map( (key) => fileData[key])
            .map( (key) => {
                return fileData[key];
            })
            .find( (value) => value != null) || '';
        return this.formatCitationKey(citationKey);
    }

    generate(): string {
        let vaultFileRecords = this.dataService.refresh();
        let citations: string[] = [];

        let hostFileData = this.dataService.readFileNodeDataRecords(this.hostFile.path)
        this.processCitationProperties(
            hostFileData,
            this.settings.citationOutlinkPropertyNames,
            (propertyValue: FileNodeDataType) => {
                if (propertyValue.path) {
                    let fileData = this.dataService.readFileNodeDataRecords(propertyValue.path)
                    let key = this.extractCitationKey(fileData);
                    if (key) {
                        citations.push(key);
                    }
                }
            },
        );
        // vaultFileRecords.forEach( (fileData: FileNodeDataRecords) => {
        //     this.extractCitations(
        //         citations,
        //         fileData,
        //         this.settings.citationInlinkPropertyNames,
        //     );
        // });
        // if (value && value.path && value.path === this.hostFile.path) {
        // processFn(value);
        // if (filterFn(value)) {
        //     const citationKey: string = this.settings.citationKeyPropertyNames
        //     .map(key => fileData[key]).find(value => value != null) || '';
        //     citations.push(this.formatCitationKey(citationKey));
        // }
        return citations
            .sort()
            .join("\n");
    }

}

