# Bibliosidian

Have BibTex, will Obsidian.

Whether you use Zotero, PaperPile, Mendalay, JabRef etc. as your reference manager, or run with Google searches, or are riding the AI wave, all sources can be represented by a BibTeX entry, and all (good) reference managers allow you to export BibTex.

This plugin does not replace any of them.

It supplements them.

It is a *light-weight* alternative to the much heavier (and better-featured) approaches that, for e.g. "talk" directly to Zotero or other applications, and is independent of any particular reference manager, working with all of them (that export BibTeX).

The basic workflow expects you to somehow or other get a BibTeX entry into your clipboard after which this plugin will automate the following actions:

- Creation of a literature note based on the citekey
- Generation of YAML frontmatter metadata in the literature extracted
- Linking each author entry listed in the metadata to a corresponding "Author" note (creating it if required)



## Acknowledgements and Dependencies

- [Bibtex.js](https://github.com/digitalheir/bibtex-js) (MIT License)
