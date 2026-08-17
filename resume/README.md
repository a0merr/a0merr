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
pwsh resume/build.ps1              # public copy   -> Andrew_Merritt_Resume.pdf
pwsh resume/build.ps1 -WithPhone   # full copy     -> Andrew_Merritt_Resume_full.pdf
```

Requires Chrome and Node.js.

### Two variants, on purpose

`Andrew_Merritt_Resume.pdf` is committed and served from a public GitHub URL.
The default build **omits the phone number** from it. Anything marked
`class="private"` in `resume.html` is hidden by injecting a single
`display: none` rule at render time.

`-WithPhone` keeps it and writes to `Andrew_Merritt_Resume_full.pdf`, which
`.gitignore` excludes. That is the copy to attach to an application.

The reason for the split: a PDF emailed to a recruiter and a file served from
a public URL are different exposure classes, and git history is permanent —
anything committed here stays retrievable from old objects even after it is
deleted from the current version. Decide once, at build time, rather than
remembering each time.

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
- Section headings are **not** letter-spaced, deliberately. The original
  design tracked them out to `E D U C A T I O N`, which looks good but makes
  the heading extract that way as text too — and applicant-tracking systems
  use headings to split a resume into sections. Measured on this document:

  | `letter-spacing` | extracts as |
  |---|---|
  | `0.22em` | `E D U C AT I O N` |
  | `0.09em` | `E D U C AT I O N` |
  | `normal` | `EDUCATION` |

  It is effectively all-or-nothing; reducing the tracking buys no middle
  ground. If you ever want the tracked look back, that is the trade you are
  making.

- Check extraction after any styling change:

  ```powershell
  pdftotext Andrew_Merritt_Resume.pdf - | Select-Object -First 12
  ```

  What you see there is roughly what a resume parser sees.
