<#
FitLog - push the code to GitHub, ready for GitHub Pages.

NOTE: this file is intentionally ASCII-only.
Windows PowerShell 5.1 reads .ps1 files using the system ANSI code page unless the
file starts with a UTF-8 BOM. A UTF-8 file without BOM that contains non-ASCII text
(Chinese, full-width punctuation, em dashes) gets mis-decoded into garbage bytes,
which breaks the parser with confusing errors like "missing closing }". Keeping this
script pure ASCII sidesteps the problem on every PowerShell version.

Usage (paste this one line into PowerShell):

    powershell -ExecutionPolicy Bypass -File D:\workout\tools\push-to-github.ps1

What it does:
  1. locates git.exe (it is often not on PATH)
  2. runs "npm run format" once
  3. asks for: GitHub username, display name, email, repo name
  4. commits, points "origin" at your repo, pushes
  5. prints the two URLs you need next

The commit identity is passed with "git -c", so your global git config is untouched.
If a GitHub login window pops up during the push, just sign in.
#>

$ErrorActionPreference = 'Stop'

function Write-Step($text) {
    Write-Host ''
    Write-Host "==> $text" -ForegroundColor Cyan
}

function Write-Ok($text) {
    Write-Host "    [ok] $text" -ForegroundColor Green
}

function Write-Warn($text) {
    Write-Host "    [!] $text" -ForegroundColor Yellow
}

function Fail($message) {
    Write-Host ''
    Write-Host "ERROR: $message" -ForegroundColor Red
    exit 1
}

function Assert-LastExitCode($what) {
    if ($LASTEXITCODE -ne 0) {
        Fail "$what failed with exit code $LASTEXITCODE. Copy the output above and send it to me."
    }
}

function Find-GitInGitHubDesktop {
    if (-not $env:LOCALAPPDATA) { return $null }
    $base = "$env:LOCALAPPDATA\GitHubDesktop"
    if (-not (Test-Path -LiteralPath $base)) { return $null }

    # Fast path: the known layouts of the bundled git (dugite).
    $patterns = @(
        "$base\app-*\resources\app\git\cmd\git.exe",
        "$base\app-*\resources\app\git\mingw64\bin\git.exe",
        "$base\app-*\resources\app\git\bin\git.exe"
    )
    foreach ($pattern in $patterns) {
        $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { return $found.FullName }
    }

    # Slow path: the layout changes between GitHub Desktop releases, so look for
    # any usable git.exe under the app folder before giving up.
    $any = Get-ChildItem -Path $base -Filter 'git.exe' -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -like '*\cmd\git.exe' -or $_.FullName -like '*\bin\git.exe' } |
        Select-Object -First 1
    if ($any) { return $any.FullName }

    return $null
}

function Find-Git {
    # No Join-Path here: if an env var were empty, Join-Path would throw and abort.
    $candidates = @(
        'C:\Program Files\Git\cmd\git.exe',
        'C:\Program Files (x86)\Git\cmd\git.exe',
        'C:\Program Files\Git\bin\git.exe'
    )
    if ($env:LOCALAPPDATA) { $candidates += "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe" }
    if ($env:ProgramFiles) { $candidates += "$env:ProgramFiles\Git\cmd\git.exe" }

    foreach ($path in $candidates) {
        if (Test-Path -LiteralPath $path) { return $path }
    }

    $command = Get-Command git -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    # GitHub Desktop ships its own git and does not put it on PATH.
    $bundled = Find-GitInGitHubDesktop
    if ($bundled) { return $bundled }

    return $null
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

Write-Host 'FitLog -> GitHub Pages' -ForegroundColor White
Write-Host "Repo folder: $repoRoot"
Write-Host 'Reminder: the empty GitHub repository must already exist before pushing.'

# ---------------------------------------------------------------- 1. find git
Write-Step 'Looking for git'
$git = Find-Git
if (-not $git) {
    Write-Host ''
    Write-Host 'git.exe was not found. Pick whichever is easiest:' -ForegroundColor Red
    Write-Host ''
    Write-Host '  A. Install Git for Windows (one command), then run this script again:'
    Write-Host '       winget install --id Git.Git -e --source winget' -ForegroundColor Cyan
    Write-Host '     Close and reopen PowerShell afterwards so PATH refreshes.'
    Write-Host ''
    Write-Host '  B. Using GitHub Desktop instead? Then you do not need this script at all:'
    Write-Host '       File -> Add local repository -> pick D:\workout'
    Write-Host '       -> type a summary -> Commit to main'
    Write-Host '       -> Publish repository -> name it workoutapp'
    Write-Host '       -> uncheck "Keep this code private" -> Publish'
    Write-Host ''
    Write-Host '--- diagnostics: send this block to me if you want me to look ---' -ForegroundColor DarkGray
    Write-Host "  LOCALAPPDATA = $env:LOCALAPPDATA"
    Write-Host "  ProgramFiles = $env:ProgramFiles"
    $ghd = "$env:LOCALAPPDATA\GitHubDesktop"
    Write-Host "  GitHubDesktop folder exists: $(Test-Path -LiteralPath $ghd)"
    if (Test-Path -LiteralPath $ghd) {
        Write-Host '  Folders inside GitHubDesktop:'
        Get-ChildItem -Path $ghd -Directory -ErrorAction SilentlyContinue |
            Select-Object -First 10 |
            ForEach-Object { Write-Host "    $($_.Name)" }
    }
    exit 1
}
Write-Ok "git: $git"

# ---------------------------------------------------------------- 2. format
Write-Step 'Running npm run format'
if (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules')) {
    & npm run format 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn 'format failed, skipping (does not block the push)'
    } else {
        Write-Ok 'formatting done'
    }
} else {
    Write-Warn 'node_modules missing, skipping. Run "npm install" first if you want it.'
}

# ---------------------------------------------------------------- 3. input
Write-Step 'A few details'
$githubUser = Read-Host 'Your GitHub username (e.g. zhangsan)'
if ([string]::IsNullOrWhiteSpace($githubUser)) {
    Fail 'GitHub username cannot be empty.'
}
$githubUser = $githubUser.Trim()

$displayName = Read-Host "Commit display name (Enter = $githubUser)"
if ([string]::IsNullOrWhiteSpace($displayName)) { $displayName = $githubUser }

$email = Read-Host "Commit email (Enter = $githubUser@users.noreply.github.com)"
if ([string]::IsNullOrWhiteSpace($email)) { $email = "$githubUser@users.noreply.github.com" }

$repoName = Read-Host 'GitHub repository name (Enter = workoutapp)'
if ([string]::IsNullOrWhiteSpace($repoName)) { $repoName = 'workoutapp' }
$repoName = $repoName.Trim()

# ---------------------------------------------------------------- 4. commit
Write-Step 'Committing'
& $git add -A
Assert-LastExitCode 'git add'

$pending = & $git status --porcelain
if ([string]::IsNullOrWhiteSpace(($pending -join ''))) {
    Write-Ok 'nothing new to commit'
} else {
    & $git -c "user.name=$displayName" -c "user.email=$email" commit -m 'FitLog: training log, supplements, history, stats, PWA'
    Assert-LastExitCode 'git commit'
    Write-Ok 'commit created'
}

# ---------------------------------------------------------------- 5. remote
Write-Step 'Pointing origin at your repository'
$remoteUrl = "https://github.com/$githubUser/$repoName.git"
$existing = & $git remote
if ($existing -contains 'origin') {
    & $git remote set-url origin $remoteUrl
    Assert-LastExitCode 'git remote set-url'
    Write-Ok "origin updated -> $remoteUrl"
} else {
    & $git remote add origin $remoteUrl
    Assert-LastExitCode 'git remote add'
    Write-Ok "origin added -> $remoteUrl"
}

# ---------------------------------------------------------------- 6. push
Write-Step 'Pushing (a GitHub login window may pop up - sign in there)'
& $git branch -M main
Assert-LastExitCode 'git branch'

& $git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'Push failed.' -ForegroundColor Red
    Write-Host ''
    Write-Host 'If the message above says "repository not found", it means the GitHub'
    Write-Host 'repository does not exist yet. Create it first - empty, no README, no'
    Write-Host '.gitignore - and then run this script again:'
    Write-Host "  https://github.com/new?name=$repoName" -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'If instead you cancelled the GitHub login window, just run this script again.'
    exit 1
}
Write-Ok 'pushed'

# ---------------------------------------------------------------- 7. next
$pagesUrl = "https://github.com/$githubUser/$repoName/settings/pages"
$siteUrl = "https://$githubUser.github.io/$repoName/"

Write-Host ''
Write-Host '====================================================='
Write-Host ' Two more steps, both in the browser:'
Write-Host '====================================================='
Write-Host ''
Write-Host ' 1. Wait about a minute. The "Actions" tab of your repo shows the progress.'
Write-Host '    It normally enables GitHub Pages by itself - no settings to change.'
Write-Host '    Only if it fails with "Get Pages site failed": open'
Write-Host "      $pagesUrl"
Write-Host '    set Source to "GitHub Actions", then re-run the failed job.'
Write-Host ''
Write-Host ' 2. Once the Action is green, open this on your phone:'
Write-Host "      $siteUrl" -ForegroundColor Cyan
Write-Host ''
Write-Host ' Add to home screen:'
Write-Host '   Android/Chrome: menu -> Install app / Add to Home screen'
Write-Host '   iOS/Safari:     Share -> Add to Home Screen'
Write-Host ''
Write-Host ' It keeps working offline once opened (data lives on the phone).'
Write-Host ''
