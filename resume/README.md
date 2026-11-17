# Resume source

`Andrew_Merritt_Resume.pdf` in the repo root is **generated**. Edit the source
here, not the PDF.

| File | Purpose |
|---|---|
| `resume.html` | The content. This is the file you edit. |
| `resume.css` | Print styling, sized in points to match the PDF page. |
| `build.js` | Renders the PDF, sets metadata, verifies the result. |
| `build.ps1` | Thin PowerShell wrapper around `build.js`. |
| `set-metadata.js` | Stamps `/Title` and `/Author` onto Chrome's output. |
| `verify.js` | Post-build checks; fails the build if any don't hold. |
| `private.example.json` | Template for `private.json`, the untracked file that holds the phone number. |

## Build

```sh
node resume/build.js                # public copy   -> Andrew_Merritt_Resume.pdf
node resume/build.js --with-phone   # full copy     -> Andrew_Merritt_Resume_full.pdf
```

Works on Windows, macOS and Linux. `pwsh resume/build.ps1 [-WithPhone]` does
the same thing. Requires Node.js and Chrome, Chromium or Edge; set
`CHROME_PATH` to pick a specific browser.

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

### Where the phone number lives

Not in this repo. `resume.html` is as public as the PDF, so it carries a
`{{PHONE}}` placeholder instead of the number. `--with-phone` fills it in
from, in order:

1. the `RESUME_PHONE` environment variable, or
2. `resume/private.json`. Copy `private.example.json` to that name and put
   the real number in. `.gitignore` excludes it.

With neither set, `--with-phone` stops with a message saying so. The public
build needs neither.

Every build, public included, also refuses to run if `resume.html` contains
anything shaped like a phone number, so one can't be pasted back into the
source and committed by accident.

## What `verify.js` checks

- **Exactly one page.** Overflow is the usual failure when adding content.
- **No link points at a bare domain.** This caught a real bug: the "LinkedIn"
  link pointed at `https://www.linkedin.com/` instead of the profile, so
  clicking it went to LinkedIn's front page. It shipped in two revisions
  before anyone noticed, because the *visible text* read "LinkedIn" and looked
  fine — only the link target was wrong. The personal site
  (`https://a0merr.github.io/`) is the one allowed exception: its home page is
  the destination.
- **`/Title` and `/Author` are set.** An earlier revision had `/Author` set to
  the literal placeholder `Un-named`.

## If content overflows to a second page

Take it from whitespace between blocks before taking it from the type — a
smaller font is the most visible change and the least effective per point
saved. In order:

1. `margin-top` on `.entry` (currently `1pt`) and `h2` (`3pt`). Roughly 11
   entries and 8 headings, so 1pt here is worth about a line and a half.
2. `margin-top` on `li` (currently `0.3pt`), about 20 of them.
3. `line-height` on `body` (currently `1.10`). Below about `1.08` the text
   starts to look crowded.
4. Body `padding` — but keep at least `18pt` (0.25in) bottom margin, since
   many printers cannot print closer to the edge than that.
5. `--body` font size — last resort; below about `8.5pt` it reads as cramped.

Shortening a bullet that wraps by only two or three words is often worth more
than any of these, and costs nothing visually.

**These levers are close to spent.** The page currently fits with very little
slack, and the values above are already near the bottom of their comfortable
range. The next thing that overflows should be solved by cutting content, not
by tightening further — a resume squeezed to `1.06` leading with 0pt between
entries reads as cramped, and that impression costs more than the line saved.
Adding a new role is a good moment to retire an old one.

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

  ```sh
  pdftotext Andrew_Merritt_Resume.pdf - | head -12                    # Linux / macOS
  pdftotext Andrew_Merritt_Resume.pdf - | Select-Object -First 12     # PowerShell
  ```

  What you see there is roughly what a resume parser sees.
