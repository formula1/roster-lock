# humanInfo

Every roster piece has a `humanInfo` object:

```
{ name: string, author: string, url: string, image?: string }
```

`name`, `author`, and `url` are required; `image` is optional. `name` and
`author` must be "friendly strings" (validated), `url` and `image` must be
valid URLs.

## Where it comes from when a piece is added

When a folder is scanned and added as a roster piece, `humanInfo` is filled
in one of two ways:

1. **`rosterlock.piece-meta.json` in the folder** - if present, its
   `humanInfo` field is used directly (along with `downloadSources` and
   `pathVariables`), with no autofill needed. This is the convention content
   authors are expected to follow if they want the folder to self-describe
   its metadata.
2. **No metadata file** - `humanInfo` defaults to empty strings
   (`{ name: "", author: "", url: "" }`) and the user has to fill it in by
   hand in the Roster page.

## What the assistant can help with

Case 2 is where a suggestion is useful: after a piece is added with empty
`humanInfo`, look at what's actually in the folder (file names, any loose
`.json` with a `title`/`name`-like field, folder name itself) and propose a
`name`/`author` guess.

This must always be a **proposal the user reviews and edits before it's
saved** - never write `humanInfo` directly. The published lock file is
semver'd and shared with others; a wrong or made-up name/author baked in
silently is worse than leaving the field empty for the user to fill in
themselves.

Do not invent a `url` - only suggest one if the folder or its metadata
actually contains one.
