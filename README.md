# Bibliosidian

Have BibTex, will Obsidian.

Whether you use Zotero, PaperPile, Mendalay, JabRef etc. as your reference manager, or run with Google searches, or are riding the AI wave, all sources can be represented by a BibTeX entry, and all (good) reference managers allow you to export BibTex.

This plugin does not replace any of them.

It supplements them.

It is a *light-weight* alternative to the much heavier (and better-featured) approaches that, for e.g. "talk" directly to Zotero or other applications, and is independent of any particular reference manager, working with all of them (that export BibTeX).

The basic workflow starts after you get a BibTeX entry into your clipboard.
This plugin will then automate the following actions:


## Features

### Source reference note creation

- Creation of a literature note based on the citation key
- Generation of YAML frontmatter metadata in the literature extracted
- Linking each author entry listed in the metadata to a corresponding "Author" note (creating it if required)

### Source holdings import and integration

This plugin also reloves some of the busy work of integrating an external PDF into your note graph by providing an import service:

- Renaming the imported file to match the (base) filename of the active file (assumed to be a reference note, o otherwise, a note you want to associate with the imported file), and copying it into the vault into a (customizable) subdirectory.
- Adding a link to the newly imported file to the active file's frontmatter YAML metadata.

### Generate citation list from outlinked or inlinked properties

A list of citations (``[@citekey]``) can be generated based on reference notes either linking to or being linked from the current note.

## Installation

Until the package is not available on the Obsidian community store, you will need
to clone the repository and build it yourself.

1. You need to have the following installed:

    - [npm](https://www.npmjs.com/)
    - [git](https://git-scm.com/)

2. Open the `.obsidian/plugins/` folder of your vault in a system shell or terminal.
   You can get here directly in the terminal or otherwise have Obsidian help you:
	- You will need to enable "Community Plugins" for this to work.
	- Open the settings panel in Obsidian, and navigate to the Plugins section
	- Enable community plugins and then click "open plugins folder".
	- Open a terminal window in this folder.
3. Run: `git clone git@github.com:jeetsukumaran/obsidian-bibliosidian.git`
4. Run: `npm i`
5. Run: `npm run build`
6. Enable the plugin from the "Community Plugins" settings page

This will produce a `main.js` file inside the repository folder, which Obsidian can open and make use of directly.
There's nothing else you need to do.

## Acknowledgements and Dependencies

- [Bibtex.js](https://github.com/digitalheir/bibtex-js)

    > Copyright (c) 2017 Maarten Trompper
    >
    > Permission is hereby granted, free of charge, to any person obtaining a copy
    > of this software and associated documentation files (the "Software"), to deal
    > in the Software without restriction, including without limitation the rights
    > to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    > copies of the Software, and to permit persons to whom the Software is
    > furnished to do so, subject to the following conditions:
    >
    > The above copyright notice and this permission notice shall be included in all
    > copies or substantial portions of the Software.
    >
    > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    > IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    > FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    > LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    > OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    > SOFTWARE.

- [YAML](https://github.com/eemeli/yaml)

    > Copyright Eemeli Aro <eemeli@gmail.com>
    >
    > Permission to use, copy, modify, and/or distribute this software for any purpose
    > with or without fee is hereby granted, provided that the above copyright notice
    > and this permission notice appear in all copies.
    >
    > THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    > REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
    > FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    > INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
    > OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
    > TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
    > THIS SOFTWARE.

## License

obsidian-bibliosidian © 2024 by Jeet Sukumaran is licensed under Attribution-ShareAlike 4.0 International.
See LICENSE.md for more information.
