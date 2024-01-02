# Bibliosidian

Have BibTex, will Obsidian.

Whether you use Zotero, PaperPile, Mendalay, JabRef etc. as your reference manager, or run with Google searches, or are riding the AI wave, all sources can be represented by a BibTeX entry, and all (good) reference managers allow you to export BibTex.

This plugin does not replace any of them.

It supplements them.

It is a *light-weight* alternative to the much heavier (and better-featured) approaches that, for e.g. "talk" directly to Zotero or other applications, and is independent of any particular reference manager, working with all of them (that export BibTeX).

The basic workflow starts after you get a BibTeX entry into your clipboard.
This plugin will then automate the following actions:

- Creation of a literature note based on the citekey
- Generation of YAML frontmatter metadata in the literature extracted
- Linking each author entry listed in the metadata to a corresponding "Author" note (creating it if required)

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

- [Bibtex.js](https://github.com/digitalheir/bibtex-js) (MIT License)
