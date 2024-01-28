import {
    App,
} from 'obsidian';

// ** Dataview **
// Available at `app.plugins.plugins.dataview.api` or as global `DataviewAPI`)
// Set up for development against:
//	```
//	npm install -D obsidian-dataview
//  ```
// https://blacksmithgu.github.io/obsidian-dataview/resources/develop-against-dataview/
import {
    DataviewApi,
    DataArray,
    DataObject,
    Link,
    Literal,
    getAPI,
} from "obsidian-dataview";

export function isDataviewLink(value: Literal): value is Link {
    return true
    return (value as Link).path !== undefined;
}

// aka a Dataview "page"
type DataviewPage = Record<string, Literal>
export type FileNodeDataRecords = DataviewPage
export type FileNodeDataType = Literal

export class DataService {
    dataviewApi: DataviewApi;
    vaultFileRecords: FileNodeDataRecords[] = [];

    constructor() {
        this.dataviewApi = getAPI();
        this.refresh()
    }

    readFileNodeDataRecords(filePath: string): FileNodeDataRecords | undefined {
        return this.dataviewApi.page(filePath)
    }

    refresh(): FileNodeDataRecords[] {
        this.vaultFileRecords = this.dataviewApi.pages().array();
        return this.vaultFileRecords;
    }

}

