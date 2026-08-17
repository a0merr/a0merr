# Resume source

`Andrew_Merritt_Resume.pdf` in the repo root is **generated**. Edit the source
here, not the PDF.

| File | Purpose |
|---|---|
| `resume.html` | The content. This is the file you edit. |
| `resume.css` | Print styling, sized in points to match the PDF page. |
| `build.ps1` | Renders the PDF, sets metadata, verifies the result. |
| `set-metadata.js` | Stamps `/Title` and `/Author` onto Chrome's output. |
| `verify.js` | Post-build checks; fails the build if any don't hold. |

## Build

```powershell
pwsh resume/build.ps1
```

Writes `Andrew_Merritt_Resume.pdf` to the repo root — the path the README's
Resume badge links to. Requires Chrome and Node.js.

## What `verify.js` checks

- **Exactly one page.** Overflow is the usual failure when adding content.
- **No link points at a bare domain.** This caught a real bug: the "LinkedIn"
  link pointed at `https://www.linkedin.com/` instead of the profile, so
  clicking it went to LinkedIn's front page. It shipped in two revisions
  before anyone noticed, because the *visible text* read "LinkedIn" and looked
  fine — only the link target was wrong.
- **`/Title` and `/Author` are set.** An earlier revision had `/Author` set to
  the literal placeholder `Un-named`.

## If content overflows to a second page

Take it from whitespace between blocks before taking it from the type — a
smaller font is the most visible change and the least effective per point
saved. In order:

1. `margin-top` on `.entry` (currently `2pt`) and `h2` (`4pt`). Roughly 11
   entries and 7 headings, so 1pt here is worth about a line and a half.
2. `margin-top` on `li` (currently `0.3pt`), about 20 of them.
3. `line-height` on `body` (currently `1.11`). Below about `1.08` the text
   starts to look crowded.
4. Body `padding` — but keep at least `18pt` (0.25in) bottom margin, since
   many printers cannot print closer to the edge than that.
5. `--body` font size — last resort; below about `8.5pt` it reads as cramped.

Shortening a bullet that wraps by only two or three words is often worth more
than any of these, and costs nothing visually.

## Notes

- Fonts are `Carlito, Calibri`. They are metric-compatible, so the layout is
  identical whichever is installed — Calibri on Windows, Carlito on Linux CI.
- Section headings use wide `letter-spacing`. It matches the original design,
  but be aware it makes headings extract as `E D U C A T I O N`, which some
  applicant-tracking systems will not match against the keyword "Education".
  The body text, which is what those systems actually parse for skills and
  titles, extracts cleanly.
