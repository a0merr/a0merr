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

Adjust in this order, checking the render after each step:

1. `line-height` on `body` (currently `1.14`) — down to about `1.12`.
2. `margin-top` on `h2` and `.entry`.
3. Body `padding` (the page margins).
4. `--body` font size — last resort; below about `8.5pt` it reads as cramped.

## Notes

- Fonts are `Carlito, Calibri`. They are metric-compatible, so the layout is
  identical whichever is installed — Calibri on Windows, Carlito on Linux CI.
- Section headings use wide `letter-spacing`. It matches the original design,
  but be aware it makes headings extract as `E D U C A T I O N`, which some
  applicant-tracking systems will not match against the keyword "Education".
  The body text, which is what those systems actually parse for skills and
  titles, extracts cleanly.
