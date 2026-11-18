# One-time setup (Windows PowerShell). Linux/macOS: run setup.sh instead.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
python -m venv .venv
.\.venv\Scripts\python -m pip install -U pip
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m playwright install chromium
.\.venv\Scripts\python engine\make_video.py catalog
.\.venv\Scripts\python engine\make_video.py validate videos\lie-shrinks-you
Write-Host "SETUP OK  ->  activate with: .\.venv\Scripts\Activate.ps1"
