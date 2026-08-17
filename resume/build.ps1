<#
.SYNOPSIS
    Builds Andrew_Merritt_Resume.pdf from resume.html.

.DESCRIPTION
    Renders resume.html with headless Chrome, then stamps the PDF's /Author
    (Chrome fills in /Title from the <title> tag but leaves /Author empty).
    Finally it verifies the result: exactly one page, and no link pointing at
    a bare domain.

    Run from anywhere:  pwsh resume/build.ps1

.NOTES
    Requires Google Chrome and Node.js. The PDF is written to the repo root,
    which is the path the README's Resume badge links to.
#>

[CmdletBinding()]
param(
    # Keep the phone number. Produces the copy meant to be sent directly to an
    # employer, written to Andrew_Merritt_Resume_full.pdf, which .gitignore
    # keeps out of the repo. Without this switch the build produces the public
    # copy - the one served from a public GitHub URL - with the phone number
    # omitted.
    [switch]$WithPhone,

    # Skip the post-render verification (not recommended).
    [switch]$SkipVerify
)

$ErrorActionPreference = 'Stop'

<#
    Runs a native executable without letting PowerShell mistake its stderr
    output for a failure.

    Windows PowerShell wraps every stderr line from a native process in an
    ErrorRecord. Under $ErrorActionPreference = 'Stop' that becomes a
    terminating error even when the process exits 0 - and Chrome reports
    "N bytes written to file ..." on stderr on a completely successful run.
    So stderr is captured, the preference is relaxed for the duration of the
    call, and success is judged by the exit code, which is the only reliable
    signal.
#>
function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$Arguments,
        [switch]$PassThroughOutput
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($PassThroughOutput) {
            & $FilePath @Arguments 2>&1 | ForEach-Object { Write-Host "  $_" }
        }
        else {
            & $FilePath @Arguments 2>&1 | Out-Null
        }
        return $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

$ResumeDir = $PSScriptRoot
$RepoRoot = Split-Path $ResumeDir -Parent
$Source = Join-Path $ResumeDir 'resume.html'
$Output = if ($WithPhone) {
    Join-Path $RepoRoot 'Andrew_Merritt_Resume_full.pdf'
}
else {
    Join-Path $RepoRoot 'Andrew_Merritt_Resume.pdf'
}

if (-not (Test-Path $Source)) { throw "Missing source: $Source" }

# --- Locate Chrome --------------------------------------------------------
$ChromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$Chrome = $ChromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Chrome) { throw "Chrome not found. Looked in:`n  $($ChromeCandidates -join "`n  ")" }

# --- Render ---------------------------------------------------------------
# Chrome renders to a temp file first so a failed run can't leave a truncated
# PDF sitting at the path the README links to.
$Temp = Join-Path ([System.IO.Path]::GetTempPath()) "resume-$PID.pdf"

<#
    For the public build, hide anything marked .private by rendering a copy of
    the page with one extra rule injected.

    The copy has to live in this same directory, because resume.html links
    resume.css with a relative href - rendering from the temp directory would
    silently produce an unstyled page. It is removed in the finally block
    below whether or not the build succeeds.
#>
$RenderSource = $Source
$Scratch = $null
if (-not $WithPhone) {
    $Scratch = Join-Path $ResumeDir '.build-public.html'
    $html = Get-Content $Source -Raw
    if ($html -notmatch '</head>') { throw 'resume.html has no </head> to inject into.' }
    $html = $html -replace '</head>', "  <style>.private { display: none; }</style>`n  </head>"
    Set-Content -Path $Scratch -Value $html -Encoding utf8
    $RenderSource = $Scratch
}

$SourceUri = ([System.Uri](Resolve-Path $RenderSource).Path).AbsoluteUri

try {

Write-Host "Rendering $Source" -ForegroundColor Cyan
Write-Host ("  variant: {0}" -f $(if ($WithPhone) { 'full (includes phone number)' } else { 'public (phone number omitted)' })) -ForegroundColor DarkGray

# --no-pdf-header-footer suppresses Chrome's default date/URL/page-number
# furniture. --run-all-compositor-stages-before-draw and the virtual time
# budget make sure layout has fully settled before the snapshot is taken,
# so the output is byte-stable between runs.
$exit = Invoke-Native $Chrome @(
    '--headless'
    '--disable-gpu'
    '--no-pdf-header-footer'
    '--run-all-compositor-stages-before-draw'
    '--virtual-time-budget=5000'
    "--print-to-pdf=$Temp"
    $SourceUri
)
if ($exit -ne 0) { throw "Chrome exited with code $exit." }
if (-not (Test-Path $Temp)) { throw 'Chrome produced no output.' }

# --- Stamp /Author --------------------------------------------------------
# Still working on a temp file: $Output is the path the README badge serves,
# so nothing lands there until the build has passed verification.
$Stamped = Join-Path ([System.IO.Path]::GetTempPath()) "resume-$PID-stamped.pdf"

Write-Host 'Setting document metadata' -ForegroundColor Cyan
$exit = Invoke-Native 'node' @((Join-Path $ResumeDir 'set-metadata.js'), $Temp, $Stamped) -PassThroughOutput
Remove-Item $Temp -Force -ErrorAction SilentlyContinue
if ($exit -ne 0) {
    Remove-Item $Stamped -Force -ErrorAction SilentlyContinue
    throw 'Metadata step failed.'
}

# --- Verify ---------------------------------------------------------------
if (-not $SkipVerify) {
    Write-Host 'Verifying' -ForegroundColor Cyan
    $exit = Invoke-Native 'node' @((Join-Path $ResumeDir 'verify.js'), $Stamped) -PassThroughOutput
    if ($exit -ne 0) {
        # Leave the previously published PDF untouched. A failed build must not
        # replace a good resume with a broken one.
        Remove-Item $Stamped -Force -ErrorAction SilentlyContinue
        throw 'Verification failed - see output above. Existing PDF left unchanged.'
    }
}

# Only now is it safe to publish.
Move-Item $Stamped $Output -Force

$Size = [math]::Round((Get-Item $Output).Length / 1KB, 1)
Write-Host "Built $Output ($Size KB)" -ForegroundColor Green

}
finally {
    # Runs even if a step above threw, so the injected copy never lingers in
    # the source directory to be edited or committed by mistake.
    if ($Scratch -and (Test-Path $Scratch)) { Remove-Item $Scratch -Force -ErrorAction SilentlyContinue }
}
