# Copy the runtime site to the existing WSL Apache document root.
# Run from PowerShell: ./scripts/publish-local.ps1
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$webRoot = 'C:\sites\www\fishing-maps'

$relativeFiles = @(
    'index.html'
    '.nojekyll'
    'percy-quin\sources\lake-tangipahoa-2016.pdf'
)
foreach ($directory in @('assets', 'percy-quin\data')) {
    $relativeFiles += Get-ChildItem -LiteralPath (Join-Path $projectRoot $directory) -File -Recurse |
        ForEach-Object { $_.FullName.Substring($projectRoot.Length + 1) }
}

# Check all inputs before copying. Only runtime folders and explicit files are included.
foreach ($relativeFile in $relativeFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relativeFile) -PathType Leaf)) {
        throw "Missing site file: $relativeFile"
    }
}

foreach ($relativeFile in $relativeFiles) {
    $sourceFile = Join-Path $projectRoot $relativeFile
    $targetFile = Join-Path $webRoot $relativeFile
    New-Item -ItemType Directory -Path (Split-Path -Parent $targetFile) -Force | Out-Null
    Copy-Item -LiteralPath $sourceFile -Destination $targetFile -Force
    if ((Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash -ne
        (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash) {
        throw "Copy verification failed: $relativeFile"
    }
}

Write-Output "Copied and verified $($relativeFiles.Count) site files in $webRoot."
Write-Output 'Local test URL: http://localhost/fishing-maps/'
Write-Output 'GitHub Pages publishing is handled separately through the source repository.'
