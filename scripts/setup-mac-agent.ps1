#!/usr/bin/env pwsh
# ============================================================
#  IPA Compilor — Mac Build Agent Setup Script
#  Run this ONCE on the remote Mac to prepare the agent
#  Usage: ssh user@mac "bash <(curl -s https://raw...)"
# ============================================================

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗"
Write-Host "  ║  IPA Compilor — Mac Build Agent Setup       ║"
Write-Host "  ╚══════════════════════════════════════════════╝"
Write-Host ""

function Step($n, $msg) { Write-Host "  [$n] → $msg" }
function Ok($msg)        { Write-Host "      ✓ $msg" }
function Warn($msg)      { Write-Host "      ⚠ $msg" }

# 1. Xcode Command Line Tools
Step "01" "Checking Xcode Command Line Tools..."
$xcodeCheck = (xcode-select -p 2>/dev/null)
if ($xcodeCheck) { Ok "Xcode CLT at $xcodeCheck" }
else {
    Warn "Not installed — run: xcode-select --install"
    exit 1
}

# 2. Homebrew
Step "02" "Checking Homebrew..."
if (Get-Command brew -ErrorAction SilentlyContinue) {
    brew update | Out-Null
    Ok "Homebrew present"
} else {
    Write-Host "      Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
}

# 3. Tools
Step "03" "Installing build tools..."
$tools = @("swiftlint", "swiftformat", "xcbeautify", "fastlane")
foreach ($t in $tools) {
    brew install $t 2>/dev/null
    Ok $t
}

# 4. Create workspace
Step "04" "Creating workspace at ~/ipa-compilor..."
$dirs = @(
    "~/ipa-compilor/swift-project/Sources"
    "~/ipa-compilor/artifacts/ipa"
    "~/ipa-compilor/artifacts/archives"
    "~/ipa-compilor/artifacts/logs"
    "~/ipa-compilor/config"
)
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Force -Path (Resolve-Path $d -ErrorAction SilentlyContinue)?.Path ?? $d | Out-Null
}
Ok "Workspace ready"

# 5. SSH authorized_keys hint
Step "05" "SSH key setup..."
Write-Host "      Add your Windows public key to ~/.ssh/authorized_keys:"
Write-Host "      cat C:\Users\<You>\.ssh\id_rsa.pub | ssh user@mac 'cat >> ~/.ssh/authorized_keys'"

# 6. Fastlane init
Step "06" "Fastlane setup..."
if (-not (Test-Path "~/ipa-compilor/fastlane/Fastfile")) {
    Set-Location ~/ipa-compilor
    fastlane init 2>/dev/null
    Ok "Fastlane initialized"
}

Write-Host ""
Write-Host "  ✓ Mac build agent is ready."
Write-Host ""
Write-Host "  Now configure your Windows side:"
Write-Host "  ipa-compilor config --ssh-host <this-mac-ip> --ssh-user $env:USER"
Write-Host ""
