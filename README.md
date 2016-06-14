# Changelog.js

A simple NodeJS script to create & update a CHANGELOG.md

## Installation and setup

```bash
npm install --save-dev shelljs-changelog
```

Now, add a `script` to `package.json` like so:

```json
  "scripts": {
    "test": "... whatever you had here before ...",
    "changelog": "changelog"
  },
```

Alright, you're good to go!

## Usage example

To update the changelog, run:

```bash
npm run changelog
```

For best results, try to run this after every time you publish.
