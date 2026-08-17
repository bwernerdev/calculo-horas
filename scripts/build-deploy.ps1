$ErrorActionPreference = "Stop"

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$staging = Join-Path $projectRoot ".deploy-package"
$zip = Join-Path $projectRoot "banco-horas-deploy.zip"

foreach ($target in @($staging, $zip)) {
  $resolved = [System.IO.Path]::GetFullPath($target)
  if (-not $resolved.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar)) {
    throw "Destino fora do projeto: $resolved"
  }
  if (Test-Path -LiteralPath $resolved) {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}

New-Item -ItemType Directory -Path (Join-Path $staging "imagens") -Force | Out-Null

$publicFiles = @(
  "index.html",
  "style.css",
  "script.js",
  "calculations.js",
  "repository.js",
  "use-cases.js",
  "supabase-config.js",
  "service-worker.js",
  "manifest.webmanifest",
  "_headers"
)

foreach ($file in $publicFiles) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination (Join-Path $staging $file)
}

Get-ChildItem -LiteralPath (Join-Path $projectRoot "imagens") -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path (Join-Path $staging "imagens") $_.Name)
}

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zip -Force
Remove-Item -LiteralPath $staging -Recurse -Force

Write-Output $zip

