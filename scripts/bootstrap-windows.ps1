#!/usr/bin/env pwsh
# ============================================================
#  IPA Compilor — Environment Bootstrap
#  Run once on a fresh Windows machine to install all deps
# ============================================================

#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$ESC = [char]27
function Cyan($t)  { "$ESC[38;2;0;212;255m$t$ESC[0m" }
function Green($t) { "$ESC[38;2;0;255;136m$t$ESC[0m" }
function Yellow($t){ "$ESC[38;2;255;184;0m$t$ESC[0m" }
function Pink($t)  { "$ESC[38;2;255;0;110m$t$ESC[0m" }
function Gray($t)  { "$ESC[38;2;74;85;104m$t$ESC[0m" }

function Step($n, $msg) { Write-Host ""; Write-Host "  $(Cyan "[$n]") → $msg" }
function Ok($msg)        { Write-Host "      $(Green "✓") $msg" }
function Warn($msg)      { Write-Host "      $(Yellow "⚠") $msg" }
function Err($msg)       { Write-Host "      $(Pink "✗") $msg" }

Write-Host ""
Write-Host "  $(Cyan "══════════════════════════════════════════════════════")"
Write-Host "  $(Cyan "  IPA Compilor — Windows Environment Bootstrap")"
Write-Host "  $(Cyan "══════════════════════════════════════════════════════")"
Write-Host ""

# ── Node.js ───────────────────────────────────────────────────
Step "01" "Checking Node.js..."
$nodeVer = node --version 2>$null
if ($nodeVer) {
    $major = [int]$nodeVer.Replace("v","").Split(".")[0]
    if ($major -ge 20) { Ok "Node.js $nodeVer" }
    else { Warn "Node.js $nodeVer < 20.x — please upgrade: https://nodejs.org" }
} else {
    Err "Node.js not found"
    Write-Host "      Install: winget install OpenJS.NodeJS.LTS"
}

# ── PowerShell 7 ──────────────────────────────────────────────
Step "02" "Checking PowerShell version..."
$psVer = $PSVersionTable.PSVersion
if ($psVer.Major -ge 7) { Ok "PowerShell $($psVer.ToString())" }
else { Warn "PowerShell $($psVer.ToString()) — upgrade: winget install Microsoft.PowerShell" }

# ── Swift for Windows ─────────────────────────────────────────
Step "03" "Checking Swift for Windows..."
$swiftVer = (swift --version 2>$null) -join ""
if ($swiftVer -match "Swift") { Ok $swiftVer }
else {
    Warn "Swift not found"
    Write-Host "      Install: https://www.swift.org/download/#windows"
    Write-Host "      Or via WinGet: winget install Swift.Toolchain"
}

# ── SSH Client ────────────────────────────────────────────────
Step "04" "Checking SSH client..."
if (Get-Command ssh -ErrorAction SilentlyContinue) { Ok "OpenSSH client found" }
else {
    Warn "SSH not found — enable via Windows Optional Features"
    Write-Host "      Add-WindowsCapability -Online -Name OpenSSH.Client"
}

# ── Docker ───────────────────────────────────────────────────
Step "05" "Checking Docker..."
$dockerInfo = docker info 2>$null
if ($LASTEXITCODE -eq 0) { Ok "Docker Engine running" }
else { Warn "Docker not running — install Docker Desktop: https://docs.docker.com/desktop/windows/" }

# ── rsync ─────────────────────────────────────────────────────
Step "06" "Checking rsync..."
if (Get-Command rsync -ErrorAction SilentlyContinue) { Ok "rsync found" }
else {
    Warn "rsync not found"
    Write-Host "      Options: WSL2, Cygwin, or: winget install RsyncNet.rsync"
}

# ── SSH Key ───────────────────────────────────────────────────
Step "07" "Checking SSH key pair..."
$keyPath = "$env:USERPROFILE\.ssh\id_rsa"
if (Test-Path $keyPath) {
    Ok "SSH key exists at $keyPath"
} else {
    Write-Host "      $(Yellow "⚠") No SSH key found — generating..."
    New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ssh" | Out-Null
    & ssh-keygen -t rsa -b 4096 -f $keyPath -N '""' -C "ipa-compilor@windows" 2>$null
    if (Test-Path $keyPath) { Ok "SSH key generated → $keyPath" }
    else { Err "Could not generate SSH key" }
}

# ── npm install ───────────────────────────────────────────────
Step "08" "Installing npm dependencies..."
if (Test-Path "package.json") {
    npm install
    if ($LASTEXITCODE -eq 0) { Ok "npm dependencies installed" }
    else { Err "npm install failed" }
} else {
    Warn "package.json not found — run from project root"
}

# ── Artifact directories ──────────────────────────────────────
Step "09" "Creating artifact directories..."
@("artifacts\ipa","artifacts\logs","artifacts\cache","artifacts\archives","artifacts\builds") | ForEach-Object {
    New-Item -ItemType Directory -Force -Path $_ | Out-Null
    Ok $_
}

# ── Summary ───────────────────────────────────────────────────
Write-Host ""
Write-Host "  $(Cyan "──────────────────────────────────────────────────────")"
Write-Host "  $(Green "Bootstrap complete.")"
Write-Host ""
Write-Host "  Next steps:"
Write-Host "  $(Cyan "1.") Edit $(Cyan "config\ipa-compilor.yaml") with your project settings"
Write-Host "  $(Cyan "2.") Set SSH host: $(Cyan ".\core\ipa-compilor.ps1 -Action config")"
Write-Host "  $(Cyan "3.") Import signing cert: $(Cyan ".\scripts\cert-manager.ps1 -Action import -CertPath <p12>")"
Write-Host "  $(Cyan "4.") Launch CLI: $(Cyan "npm start")"
Write-Host "  $(Cyan "5.") Build: $(Cyan "npm start -- build")"
Write-Host ""
