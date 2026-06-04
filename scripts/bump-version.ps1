# Twinkle Hub 教師指南 — 版本升級腳本
# 用途：每次更新網站內容後執行，會同步 sw.js / version.json / index.html 三處版本號，
#       讓 Service Worker 的 byte 改變，使用者端就會跳出「有新版本」更新通知。
# 用法（在 twinkle-hub-guide 目錄下）：
#   powershell -ExecutionPolicy Bypass -File scripts\bump-version.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\bump-version.ps1 -Notes "修正某某文字"

param(
  [string]$Notes = "內容更新"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$enc = New-Object System.Text.UTF8Encoding($false)

# 版本字串：日期 + 當日序號（同日多次自動 +1）
$today = Get-Date -Format "yyyy.MM.dd"
$verJsonPath = Join-Path $root "version.json"
$seq = 1
if (Test-Path $verJsonPath) {
  $old = (Get-Content $verJsonPath -Raw | ConvertFrom-Json).version
  if ($old -match "^$([regex]::Escape($today))-(\d+)$") { $seq = [int]$Matches[1] + 1 }
}
$ver = "$today-$seq"
Write-Host "新版本號：$ver"

# 1) version.json
$verObj = [ordered]@{ version = $ver; notes = $Notes }
[System.IO.File]::WriteAllText($verJsonPath, ($verObj | ConvertTo-Json), $enc)

# 2) sw.js  BUILD_VERSION
$swPath = Join-Path $root "sw.js"
$sw = [System.IO.File]::ReadAllText($swPath, [System.Text.Encoding]::UTF8)
$sw = [regex]::Replace($sw, "const BUILD_VERSION = '[^']*';", "const BUILD_VERSION = '$ver';")
[System.IO.File]::WriteAllText($swPath, $sw, $enc)

# 3) index.html  APP_VERSION
$idxPath = Join-Path $root "index.html"
$idx = [System.IO.File]::ReadAllText($idxPath, [System.Text.Encoding]::UTF8)
$idx = [regex]::Replace($idx, "var APP_VERSION='[^']*';", "var APP_VERSION='$ver';")
[System.IO.File]::WriteAllText($idxPath, $idx, $enc)

Write-Host "已更新 version.json / sw.js / index.html → $ver"
Write-Host "接著：git add -A; git commit -m `"chore: bump $ver`"; git push"
