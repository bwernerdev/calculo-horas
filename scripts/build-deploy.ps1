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

New-Item -ItemType Directory -Path $staging -Force | Out-Null

$publicFiles = @(
  "index.html",
  "service-worker.js",
  "manifest.webmanifest",
  "_headers"
)

foreach ($file in $publicFiles) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination (Join-Path $staging $file)
}

Copy-Item -LiteralPath (Join-Path $projectRoot "assets") -Destination (Join-Path $staging "assets") -Recurse

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zip -Force
Remove-Item -LiteralPath $staging -Recurse -Force

Write-Output $zip
