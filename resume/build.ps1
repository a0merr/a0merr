<#
.SYNOPSIS
    Builds Andrew_Merritt_Resume.pdf from resume.html.

.DESCRIPTION
    Thin wrapper around build.js, kept so `pwsh resume/build.ps1` keeps
    working. The build itself - render with headless Chrome/Chromium/Edge,
    stamp /Title and /Author, verify, then publish - lives in build.js, which
    runs the same way on Windows, macOS and Linux:

        node resume/build.js [--with-phone] [--skip-verify]

    See resume/README.md.

.NOTES
    Requires Chrome, Chromium or Edge, and Node.js.
#>

[CmdletBinding()]
param(
    # Keep the phone number. Writes Andrew_Merritt_Resume_full.pdf, which
    # .gitignore keeps out of the repo. Without this switch the build produces
    # the public copy, with the phone number omitted.
    [switch]$WithPhone,

    # Skip the post-render verification (not recommended).
    [switch]$SkipVerify
)

$nodeArgs = @(Join-Path $PSScriptRoot 'build.js')
if ($WithPhone) { $nodeArgs += '--with-phone' }
if ($SkipVerify) { $nodeArgs += '--skip-verify' }

# Called directly, not through 2>&1, so PowerShell passes node's stderr to the
# console as-is instead of wrapping it in ErrorRecords. Success is the exit code.
& node @nodeArgs
exit $LASTEXITCODE
