#!/usr/bin/env pwsh
# ============================================================
#  IPA Compilor — Certificate & Provisioning Manager
#  Manages signing identity lifecycle on Windows + agent
# ============================================================

#Requires -Version 7.0

param(
    [ValidateSet("import","list","export","install-profile","revoke","info")]
    [string]$Action = "list",
    [string]$CertPath   = "",
    [string]$CertPass   = "",
    [string]$ProfilePath = "",
    [string]$AgentHost  = "",
    [string]$AgentUser  = "",
    [string]$AgentKey   = "~/.ssh/id_rsa"
)

$ESC = [char]27
function Cyan($t)  { "$ESC[38;2;0;212;255m$t$ESC[0m" }
function Green($t) { "$ESC[38;2;0;255;136m$t$ESC[0m" }
function Pink($t)  { "$ESC[38;2;255;0;110m$t$ESC[0m" }
function Gray($t)  { "$ESC[38;2;74;85;104m$t$ESC[0m" }
function Bold($t)  { "$ESC[1m$t$ESC[0m" }

function Write-Banner {
    Write-Host ""
    Write-Host "  $(Cyan "────────────────────────────────────────────────────")"
    Write-Host "  $(Cyan "│")  $(Bold "Certificate & Provisioning Manager")  $(Gray "· IPA Compilor")"
    Write-Host "  $(Cyan "────────────────────────────────────────────────────")"
    Write-Host ""
}

function Import-Certificate {
    if (-not $CertPath) { Write-Host (Pink "  ✗ Specify -CertPath <path.p12>"); return }
    if (-not (Test-Path $CertPath)) { Write-Host (Pink "  ✗ File not found: $CertPath"); return }

    Write-Host "  $(Cyan "→") Importing certificate to local store..."

    # Store locally in config/certs/
    $destDir = "config\certs"
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    $destFile = Join-Path $destDir (Split-Path $CertPath -Leaf)
    Copy-Item $CertPath $destFile -Force
    Write-Host "  $(Green "✓") Certificate stored → $destFile"

    # Push to agent if configured
    if ($AgentHost) {
        Write-Host "  $(Cyan "→") Pushing certificate to Mac agent..."
        $key = $AgentKey -replace "^~", $env:USERPROFILE
        & scp -i $key -o StrictHostKeyChecking=no $CertPath "${AgentUser}@${AgentHost}:~/ipa-compilor/config/cert.p12"
        & ssh -i $key -o StrictHostKeyChecking=no "${AgentUser}@${AgentHost}" `
            "security import ~/ipa-compilor/config/cert.p12 -P '$CertPass' -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign -T /usr/bin/security"
        Write-Host "  $(Green "✓") Certificate imported to agent keychain"
    }

    # Update config
    $cfgPath = "config\ipa-compilor.yaml"
    if (Test-Path $cfgPath) {
        (Get-Content $cfgPath) -replace 'certPath:.*', "certPath: $destFile" | Set-Content $cfgPath
        Write-Host "  $(Green "✓") Config updated"
    }
}

function Install-ProvisioningProfile {
    if (-not $ProfilePath) { Write-Host (Pink "  ✗ Specify -ProfilePath <path.mobileprovision>"); return }
    if (-not (Test-Path $ProfilePath)) { Write-Host (Pink "  ✗ File not found: $ProfilePath"); return }

    # Store locally
    $destDir = "config\profiles"
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    $destFile = Join-Path $destDir (Split-Path $ProfilePath -Leaf)
    Copy-Item $ProfilePath $destFile -Force
    Write-Host "  $(Green "✓") Profile stored → $destFile"

    # Extract UUID
    $plistText = & security cms -D -i $ProfilePath 2>/dev/null
    $uuidMatch = [regex]::Match(($plistText ?? ""), '<key>UUID</key>\s*<string>([^<]+)</string>')
    $uuid = if ($uuidMatch.Success) { $uuidMatch.Groups[1].Value } else { "unknown" }
    Write-Host "  $(Cyan "◈") UUID: $uuid"

    # Push to agent
    if ($AgentHost) {
        $key = $AgentKey -replace "^~", $env:USERPROFILE
        & scp -i $key -o StrictHostKeyChecking=no $ProfilePath "${AgentUser}@${AgentHost}:~/Library/MobileDevice/Provisioning Profiles/$uuid.mobileprovision"
        Write-Host "  $(Green "✓") Profile installed on Mac agent (UUID: $uuid)"
    }

    # Update config
    $cfgPath = "config\ipa-compilor.yaml"
    if (Test-Path $cfgPath) {
        (Get-Content $cfgPath) -replace 'profilePath:.*', "profilePath: $destFile" |
            ForEach-Object { $_ -replace 'profileId:.*', "profileId: $uuid" } |
            Set-Content $cfgPath
        Write-Host "  $(Green "✓") Config updated with profile UUID"
    }
}

function Show-CertInfo {
    Write-Host "  $(Cyan "Stored certificates:")"
    $certDir = "config\certs"
    if (Test-Path $certDir) {
        Get-ChildItem $certDir -Filter "*.p12" | ForEach-Object {
            Write-Host "  $(Gray "│")  $(Cyan $_.Name)  $(Gray $_.LastWriteTime.ToString("yyyy-MM-dd"))"
        }
    } else {
        Write-Host "  $(Gray "  No certificates found. Import with -Action import -CertPath <p12>")"
    }

    Write-Host ""
    Write-Host "  $(Cyan "Stored provisioning profiles:")"
    $profDir = "config\profiles"
    if (Test-Path $profDir) {
        Get-ChildItem $profDir -Filter "*.mobileprovision" | ForEach-Object {
            Write-Host "  $(Gray "│")  $(Cyan $_.Name)  $(Gray $_.LastWriteTime.ToString("yyyy-MM-dd"))"
        }
    } else {
        Write-Host "  $(Gray "  No profiles found. Install with -Action install-profile -ProfilePath <mobileprovision>")"
    }
    Write-Host ""
}

# ── Entry ─────────────────────────────────────────────────────
Write-Banner
switch ($Action) {
    "import"          { Import-Certificate }
    "install-profile" { Install-ProvisioningProfile }
    "list"            { Show-CertInfo }
    "info"            { Show-CertInfo }
    default           { Write-Host (Pink "  ✗ Unknown action: $Action") }
}
