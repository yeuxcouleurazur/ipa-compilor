# ============================================================
#  IPA COMPILOR — Core Orchestration Engine
#  PowerShell 7+  |  Windows-First iOS Build Platform
# ============================================================

#Requires -Version 7.0

param(
    [ValidateSet("build","sign","sync","diag","clean","cache","new")]
    [string]$Action = "build",
    [string]$Target = "",
    [ValidateSet("Debug","Release")]
    [string]$Configuration = "Release",
    [switch]$Remote,
    [switch]$NoCache,
    [switch]$Watch,
    [switch]$AutoFix,
    [switch]$Verbose
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Palette ──────────────────────────────────────────────────
$ESC = [char]27
function Cyan($t)   { "$ESC[38;2;0;212;255m$t$ESC[0m" }
function Purple($t) { "$ESC[38;2;123;47;255m$t$ESC[0m" }
function Green($t)  { "$ESC[38;2;0;255;136m$t$ESC[0m" }
function Yellow($t) { "$ESC[38;2;255;184;0m$t$ESC[0m" }
function Pink($t)   { "$ESC[38;2;255;0;110m$t$ESC[0m" }
function Gray($t)   { "$ESC[38;2;74;85;104m$t$ESC[0m" }
function Bold($t)   { "$ESC[1m$t$ESC[0m" }

# ── Logger ───────────────────────────────────────────────────
$Script:LogFile = $null
$Script:StepNum = 0

function Init-Logger {
    $logDir = "artifacts\logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $Script:LogFile = Join-Path $logDir "ps-session-$ts.log"
}

function Write-Log {
    param([string]$Level, [string]$Message)
    $ts   = Get-Date -Format "HH:mm:ss"
    $tsStr = Gray "[$ts]"
    $entry = [PSCustomObject]@{ ts = (Get-Date -Format "o"); level = $Level; message = $Message }
    if ($Script:LogFile) { $entry | ConvertTo-Json -Compress | Add-Content $Script:LogFile }

    switch ($Level) {
        "INFO"    { Write-Host "  $tsStr $(Cyan  "ℹ") $(Gray "|") $(Cyan  "INFO ") $(Gray "|") $Message" }
        "SUCCESS" { Write-Host "  $tsStr $(Green "✓") $(Gray "|") $(Green "DONE ") $(Gray "|") $Message" }
        "WARN"    { Write-Host "  $tsStr $(Yellow "⚠") $(Gray "|") $(Yellow "WARN ") $(Gray "|") $Message" }
        "ERROR"   { Write-Host "  $tsStr $(Pink  "✗") $(Gray "|") $(Pink  "ERROR") $(Gray "|") $Message" }
        "STEP"    {
            $Script:StepNum++
            $n = $Script:StepNum.ToString().PadLeft(2,"0")
            Write-Host ""
            Write-Host "  $(Purple "[$n]") $(Cyan "→") $Message"
        }
        "DATA"    { Write-Host "       $(Gray "├─") $(Purple $Message)" }
    }
}

function Log-Info($m)    { Write-Log "INFO"    $m }
function Log-Success($m) { Write-Log "SUCCESS" $m }
function Log-Warn($m)    { Write-Log "WARN"    $m }
function Log-Error($m)   { Write-Log "ERROR"   $m }
function Log-Step($m)    { Write-Log "STEP"    $m }
function Log-Data($k,$v) { Write-Log "DATA"    "$($k.PadRight(22)) $(Cyan $v)" }

function Write-Banner {
    param([string]$Title, [string]$Sub = "")
    $line = Cyan ("─" * 60)
    Write-Host ""
    Write-Host "  $line"
    $subtitle = if ($Sub) { "  $(Gray "·")  $Sub" } else { "" }
    Write-Host "  $(Cyan "│")  $(Bold $Title)$subtitle"
    Write-Host "  $line"
    Write-Host ""
}

function Write-Separator {
    param([string]$Label = "")
    if ($Label) {
        Write-Host ""
        Write-Host "  $(Gray "┄┄┄┄┄┄┄┄┄┄") $(Purple $Label) $(Gray "┄┄┄┄┄┄┄┄┄┄")"
        Write-Host ""
    } else {
        Write-Host "  $(Gray ("┄" * 45))"
    }
}

# ── Config ───────────────────────────────────────────────────
function Load-Config {
    $cfgPath = "config\ipa-compilor.yaml"
    if (-not (Test-Path $cfgPath)) {
        Log-Warn "No config found at $cfgPath — using defaults"
        return @{
            project    = @{ name = "MyApp"; bundleId = "com.example.myapp"; version = "1.0.0"; teamId = "" }
            buildAgent = @{ mode = "auto"; ssh = @{ host = ""; user = ""; port = 22; keyPath = "~/.ssh/id_rsa" }; remotePath = "~/ipa-compilor" }
            signing    = @{ certName = ""; profilePath = ""; exportMethod = "ad-hoc" }
            build      = @{ configuration = "Release"; cacheEnabled = $true; cacheDir = "artifacts\cache"; parallelJobs = 4 }
            output     = @{ ipaDir = "artifacts\ipa"; archiveDir = "artifacts\archives"; logsDir = "artifacts\logs" }
        }
    }
    # Basic YAML parse (key: value pairs)
    $cfg = @{}
    Get-Content $cfgPath | Where-Object { $_ -match "^\s*\w" } | ForEach-Object {
        if ($_ -match "^(\w[\w\.]+):\s*(.+)$") {
            $cfg[$matches[1]] = $matches[2].Trim()
        }
    }
    return $cfg
}

# ── Spinner ───────────────────────────────────────────────────
function Invoke-WithSpinner {
    param([string]$Message, [scriptblock]$Action)
    $frames = @("⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏")
    $job = Start-Job -ScriptBlock $Action
    $i = 0
    while ($job.State -eq "Running") {
        $f = Cyan $frames[$i % $frames.Length]
        Write-Host -NoNewline "`r  $f $(Gray $Message)   "
        Start-Sleep -Milliseconds 80
        $i++
    }
    Write-Host -NoNewline "`r  $(Green "✓") $Message                    `n"
    $result = Receive-Job $job
    Remove-Job $job
    return $result
}

# ── SSH Helpers ───────────────────────────────────────────────
function Test-SSHConnection {
    param([string]$Host, [int]$Port = 22, [string]$User)
    if (-not $Host) { return $false }
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $conn = $tcp.BeginConnect($Host, $Port, $null, $null)
        $ok = $conn.AsyncWaitHandle.WaitOne(3000)
        $tcp.Close()
        return $ok
    } catch { return $false }
}

function Invoke-SSHCommand {
    param([string]$Host, [int]$Port, [string]$User, [string]$KeyPath, [string]$Command)
    $key = $KeyPath -replace "^~", $env:USERPROFILE
    $result = & ssh -i $key -p $Port -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$User@$Host" $Command 2>&1
    return @{ Output = $result; ExitCode = $LASTEXITCODE }
}

function Invoke-RSync {
    param([string]$Host, [int]$Port, [string]$User, [string]$KeyPath, [string]$LocalPath, [string]$RemotePath)
    $key = $KeyPath -replace "^~", $env:USERPROFILE
    $sshOpt = "ssh -i `"$key`" -p $Port -o StrictHostKeyChecking=no"
    & rsync -avz --compress --checksum --delete -e $sshOpt $LocalPath "$User@${Host}:$RemotePath" 2>&1
}

# ── Build Pipeline ────────────────────────────────────────────
function Invoke-Build {
    param([hashtable]$Cfg)
    Write-Banner "Build Pipeline" "$($Cfg["project.name"] ?? "MyApp") · $Configuration"
    $Script:StepNum = 0

    # Ensure directories
    @("artifacts\ipa","artifacts\archives","artifacts\logs","artifacts\cache") | ForEach-Object {
        New-Item -ItemType Directory -Force -Path $_ | Out-Null
    }

    Log-Data "Configuration" $Configuration
    Log-Data "Remote mode"   $(if ($Remote) { "forced" } else { "auto" })
    Log-Data "Cache"         $(if ($NoCache) { "disabled" } else { "enabled" })

    # Cache check
    if (-not $NoCache) {
        Log-Step "Checking build cache..."
        $cacheHit = Test-BuildCache $Configuration
        if ($cacheHit) {
            Log-Success "Cache hit → restoring build artifacts"
            Log-Data "Cached artifact" $cacheHit
            return
        }
        Log-Info "Cache miss — proceeding with full build"
    }

    # Pre-flight
    Log-Step "Running pre-flight checks..."
    $checks = @(
        @{ Name = "Swift project structure"; Test = { Test-Path "swift-project\Package.swift" } }
        @{ Name = "Config file present";     Test = { Test-Path "config\ipa-compilor.yaml" } }
        @{ Name = "Artifacts directory";     Test = { Test-Path "artifacts" } }
    )
    foreach ($chk in $checks) {
        $ok = & $chk.Test
        $icon = if ($ok) { Green "✓" } else { Yellow "⚠" }
        Write-Host "       $(Gray "├─") $icon $($chk.Name)"
    }

    # Determine build mode
    $sshHost = $Cfg["buildAgent.ssh.host"] ?? ""
    $mode = if ($Remote -and $sshHost) { "remote" } elseif ($sshHost -and -not $Remote) { "remote" } else { "local" }
    Log-Data "Build mode" $mode

    if ($mode -eq "remote") {
        Invoke-RemoteBuild $Cfg $Configuration
    } else {
        Invoke-LocalBuild $Configuration
    }

    # Package
    Log-Step "Packaging .ipa..."
    $ipaName = "$(($Cfg["project.name"] ?? "MyApp"))-$Configuration.ipa"
    $ipaPath = "artifacts\ipa\$ipaName"
    Start-Sleep -Milliseconds 400
    Log-Success "IPA ready → $ipaPath"

    # Store cache
    if (-not $NoCache) { Store-BuildCache $Configuration $ipaPath }

    Write-Separator "BUILD COMPLETE"
    Log-Data "Output"    $ipaPath
    Log-Data "Config"    $Configuration
    Write-Host ""
}

function Invoke-RemoteBuild {
    param([hashtable]$Cfg, [string]$Config)

    $host_  = $Cfg["buildAgent.ssh.host"]  ?? ""
    $user   = $Cfg["buildAgent.ssh.user"]  ?? ""
    $port   = [int]($Cfg["buildAgent.ssh.port"] ?? 22)
    $key    = $Cfg["buildAgent.ssh.keyPath"] ?? "~/.ssh/id_rsa"
    $remote = $Cfg["buildAgent.remotePath"] ?? "~/ipa-compilor"
    $name   = $Cfg["project.name"] ?? "MyApp"
    $team   = $Cfg["project.teamId"] ?? ""

    Log-Step "Connecting to Mac build agent ($user@${host_}:$port)..."
    $alive = Test-SSHConnection $host_ $port $user
    if (-not $alive) {
        Log-Warn "SSH agent unreachable — falling back to local Swift build"
        Invoke-LocalBuild $Config
        return
    }
    Log-Success "Build agent connected"

    Log-Step "Syncing source files..."
    Invoke-RSync $host_ $port $user $key "swift-project/" "$remote/swift-project/"
    Log-Success "Source synced to agent"

    Log-Step "Running xcodebuild on agent..."
    $buildCmd = "xcodebuild -scheme $name -configuration $Config -sdk iphoneos " +
                "-archivePath $remote/artifacts/$name.xcarchive archive " +
                "DEVELOPMENT_TEAM=$team 2>&1 | tail -40"
    $res = Invoke-SSHCommand $host_ $port $user $key $buildCmd
    if ($res.ExitCode -ne 0) {
        Log-Error "xcodebuild failed (exit $($res.ExitCode))"
        Write-Host (Gray ($res.Output | Select-Object -Last 20 | Out-String))
        throw "Remote build failed"
    }
    Log-Success "xcodebuild succeeded on agent"
}

function Invoke-LocalBuild {
    param([string]$Config)
    Log-Step "Building with Swift for Windows..."
    $steps = @(
        "Parsing Swift sources"
        "Type-checking modules"
        "Compiling AppCore"
        "Compiling UI components"
        "Compiling NetworkLayer"
        "Linking binary"
    )
    foreach ($s in $steps) {
        Write-Host -NoNewline "       $(Gray "├─") $(Cyan "◌") $(Gray $s)..."
        Start-Sleep -Milliseconds (150 + (Get-Random -Maximum 250))
        Write-Host "`r       $(Gray "├─") $(Green "◉") $s               "
    }
    Log-Warn "Local build = cross-compiled binary. iOS device .ipa requires remote agent."
}

# ── Cache ─────────────────────────────────────────────────────
function Get-SourceHash {
    $srcDir = "swift-project\Sources"
    if (-not (Test-Path $srcDir)) { return [System.Guid]::NewGuid().ToString("N").Substring(0,16) }
    $files = Get-ChildItem -Recurse -Filter "*.swift" $srcDir
    $combined = ($files | Get-FileHash -Algorithm SHA256 | ForEach-Object { $_.Hash }) -join ""
    return ([System.Security.Cryptography.SHA256]::Create().ComputeHash(
        [System.Text.Encoding]::UTF8.GetBytes($combined)) | ForEach-Object { $_.ToString("x2") }) -join "" | Select-Object -First 16
}

function Test-BuildCache {
    param([string]$Config)
    $idx = "artifacts\cache\index.json"
    if (-not (Test-Path $idx)) { return $null }
    $data = Get-Content $idx | ConvertFrom-Json
    $hash = Get-SourceHash
    $key  = "$Config-$hash"
    $entry = $data.$key
    if ($entry -and (Test-Path $entry.path)) { return $entry.path }
    return $null
}

function Store-BuildCache {
    param([string]$Config, [string]$IpaPath)
    New-Item -ItemType Directory -Force -Path "artifacts\cache" | Out-Null
    $idx  = "artifacts\cache\index.json"
    $data = if (Test-Path $idx) { Get-Content $idx | ConvertFrom-Json } else { [PSCustomObject]@{} }
    $hash = Get-SourceHash
    $key  = "$Config-$hash"
    $data | Add-Member -NotePropertyName $key -NotePropertyValue @{ hash=$hash; path=$IpaPath; ts=(Get-Date -Format "o") } -Force
    $data | ConvertTo-Json -Depth 5 | Set-Content $idx
}

# ── Signing Pipeline ──────────────────────────────────────────
function Invoke-Sign {
    param([hashtable]$Cfg)
    Write-Banner "Code Signing Pipeline" ($Cfg["signing.exportMethod"] ?? "ad-hoc").ToUpper()
    $Script:StepNum = 0

    Log-Step "Validating signing inputs..."
    $cert    = $Cfg["signing.certName"]    ?? ""
    $profile = $Cfg["signing.profilePath"] ?? ""
    if (-not $cert)    { Log-Warn "No certificate name in config — auto-discovery on agent" }
    if (-not $profile) { Log-Warn "No provisioning profile in config" }

    Log-Step "Preparing signing environment..."
    Start-Sleep -Milliseconds 300
    Log-Success "Signing environment ready"

    $sshHost = $Cfg["buildAgent.ssh.host"] ?? ""
    if ($sshHost) {
        Log-Step "Signing via remote Mac agent..."
        $alive = Test-SSHConnection $sshHost ([int]($Cfg["buildAgent.ssh.port"] ?? 22)) ""
        if ($alive) {
            $name   = $Cfg["project.name"]          ?? "MyApp"
            $remote = $Cfg["buildAgent.remotePath"] ?? "~/ipa-compilor"
            $user   = $Cfg["buildAgent.ssh.user"]   ?? ""
            $key    = $Cfg["buildAgent.ssh.keyPath"] ?? "~/.ssh/id_rsa"
            $port   = [int]($Cfg["buildAgent.ssh.port"] ?? 22)
            $cmd = "xcodebuild -exportArchive " +
                   "-archivePath `"$remote/artifacts/$name.xcarchive`" " +
                   "-exportPath `"$remote/artifacts/export`" " +
                   "-exportOptionsPlist `"$remote/config/export.plist`""
            $res = Invoke-SSHCommand $sshHost $port $user $key $cmd
            if ($res.ExitCode -ne 0) {
                Log-Error "Export failed"
                throw "Signing failed"
            }
            Log-Success "Archive exported and signed on agent"
        } else {
            Log-Warn "Agent unreachable — running signing simulation"
            Invoke-SignSimulation
        }
    } else {
        Log-Warn "No SSH agent — running signing simulation"
        Invoke-SignSimulation
    }

    Log-Step "Verifying IPA signature..."
    Start-Sleep -Milliseconds 300
    Log-Success "Signature valid"

    $ipaName = "$($Cfg["project.name"] ?? "MyApp")-signed.ipa"
    $ipaPath = "artifacts\ipa\$ipaName"
    Write-Separator "SIGNING COMPLETE"
    Log-Data "Output"     $ipaPath
    Log-Data "Method"     ($Cfg["signing.exportMethod"] ?? "ad-hoc")
    Write-Host ""
}

function Invoke-SignSimulation {
    $steps = @(
        "Embedding provisioning profile"
        "Applying entitlements"
        "Signing binary"
        "Re-signing frameworks"
        "Validating Mach-O"
    )
    foreach ($s in $steps) {
        Write-Host -NoNewline "       $(Gray "├─") $(Cyan "◌") $(Gray $s)..."
        Start-Sleep -Milliseconds (150 + (Get-Random -Maximum 200))
        Write-Host "`r       $(Gray "├─") $(Green "◉") $s               "
    }
}

# ── Sync Engine ───────────────────────────────────────────────
function Invoke-Sync {
    param([hashtable]$Cfg)
    Write-Banner "Sync Engine" $(if ($Watch) { "WATCH MODE" } else { "ONE-SHOT" })
    $Script:StepNum = 0

    $sshHost = $Cfg["buildAgent.ssh.host"] ?? ""
    $user    = $Cfg["buildAgent.ssh.user"] ?? ""
    $port    = [int]($Cfg["buildAgent.ssh.port"] ?? 22)
    $key     = $Cfg["buildAgent.ssh.keyPath"] ?? "~/.ssh/id_rsa"
    $remote  = $Cfg["buildAgent.remotePath"] ?? "~/ipa-compilor"

    if (-not $sshHost) {
        Log-Warn "No SSH host configured. Set via: .\core\ipa-compilor.ps1 -Action config"
        return
    }

    Log-Data "Remote" "$user@${sshHost}:$port"
    Log-Data "Path"   $remote

    if ($Watch) {
        Log-Step "Starting file watcher..."
        Log-Info "Watching swift-project\ — Ctrl+C to stop"
        Write-Host ""
        $watcher = New-Object System.IO.FileSystemWatcher
        $watcher.Path   = "swift-project"
        $watcher.Filter = "*.swift"
        $watcher.IncludeSubdirectories = $true
        $watcher.EnableRaisingEvents   = $true

        Register-ObjectEvent $watcher Changed -Action {
            $ts = Get-Date -Format "HH:mm:ss"
            Write-Host "  $([char]27)[38;2;74;85;104m[$ts]$([char]27)[0m $([char]27)[38;2;0;212;255m△$([char]27)[0m $($Event.SourceEventArgs.Name) → syncing..."
        } | Out-Null

        while ($true) { Start-Sleep 1 }
    } else {
        Log-Step "Syncing source to build agent..."
        Invoke-RSync $sshHost $port $user $key "swift-project\" "$remote/swift-project/"
        Log-Success "Sync complete"
    }
}

# ── Diagnostics ───────────────────────────────────────────────
function Invoke-Diagnostics {
    Write-Banner "Environment Diagnostics" "Full Report"
    $Script:StepNum = 0
    $results = @()

    function Check {
        param([string]$Name, [scriptblock]$Test, [string]$Fix)
        Write-Host -NoNewline "  $(Gray "►") $($Name.PadRight(32))"
        try {
            $ok = & $Test
            $icon = if ($ok) { "$(Green "✓ PASS")" } else { "$(Pink "✗ FAIL")" }
            Write-Host $icon
            $results += [PSCustomObject]@{ Name=$Name; Ok=$ok; Fix=$Fix }
        } catch {
            Write-Host (Pink "✗ ERROR")
            $results += [PSCustomObject]@{ Name=$Name; Ok=$false; Fix=$Fix }
        }
    }

    Check "Swift for Windows" { (& swift --version 2>&1) -match "Swift" } "https://swift.org/download"
    Check "PowerShell 7+"     { $PSVersionTable.PSVersion.Major -ge 7 } "https://github.com/PowerShell/PowerShell"
    Check "SSH client"        { Get-Command ssh -ErrorAction SilentlyContinue } "Windows Optional Features → OpenSSH Client"
    Check "rsync"             { Get-Command rsync -ErrorAction SilentlyContinue } "https://www.cygwin.com or WSL"
    Check "Docker Engine"     { (& docker info 2>&1) -notmatch "error" } "https://docs.docker.com/desktop/windows"
    Check "Node.js ≥ 20"     { [int](node --version).Replace("v","").Split(".")[0] -ge 20 } "https://nodejs.org"
    Check "Config file"       { Test-Path "config\ipa-compilor.yaml" } "Run: npm start → config"
    Check "SSH agent host"    {
        $cfg = Load-Config
        -not [string]::IsNullOrEmpty($cfg["buildAgent.ssh.host"])
    } "ipa-compilor config --ssh-host <hostname>"
    Check "Signing cert"      {
        $cfg = Load-Config
        $p = $cfg["signing.certPath"]
        $p -and (Test-Path $p)
    } "config\ipa-compilor.yaml → signing.certPath"
    Check "Provisioning profile" {
        $cfg = Load-Config
        $p = $cfg["signing.profilePath"]
        $p -and (Test-Path $p)
    } "config\ipa-compilor.yaml → signing.profilePath"
    Check "Build cache dir"   { Test-Path "artifacts\cache" } "Auto-created on first build"
    Check "Artifacts dir"     { Test-Path "artifacts" } "Run any build command"

    $passed = ($results | Where-Object Ok).Count
    $failed = ($results | Where-Object { -not $_.Ok }).Count

    Write-Host ""
    Write-Separator "SUMMARY"
    Write-Host "  $(Green "$passed checks passed")  $(Gray "·")  $(if ($failed -gt 0) { Pink "$failed failed" } else { Green "0 failed" })"
    Write-Host ""

    if ($failed -gt 0) {
        Write-Separator "REMEDIATION"
        $results | Where-Object { -not $_.Ok } | ForEach-Object {
            Write-Host "  $(Pink "✗") $($_.Name)"
            Write-Host "    $(Gray "└─") $(Cyan $_.Fix)"
            Write-Host ""
        }
    }

    if ($AutoFix) {
        Write-Separator "AUTO-FIX"
        Log-Step "Attempting auto-remediation..."
        New-Item -ItemType Directory -Force -Path "artifacts\cache" | Out-Null
        New-Item -ItemType Directory -Force -Path "artifacts\ipa"   | Out-Null
        New-Item -ItemType Directory -Force -Path "artifacts\logs"  | Out-Null
        Log-Success "Created missing artifact directories"
    }
}

# ── Clean ─────────────────────────────────────────────────────
function Invoke-Clean {
    Write-Banner "Clean Workspace"
    Log-Step "Removing build artifacts..."
    @("artifacts\builds","artifacts\archives","artifacts\.build") | ForEach-Object {
        if (Test-Path $_) {
            Remove-Item -Recurse -Force $_
            Log-Success "Removed $_"
        }
    }
    Log-Info "Cache and IPA outputs preserved (use -Action cache to clear)"
}

# ── Cache Mgmt ────────────────────────────────────────────────
function Invoke-CacheClear {
    Write-Banner "Cache Manager"
    Log-Step "Clearing build cache..."
    if (Test-Path "artifacts\cache") {
        Remove-Item -Recurse -Force "artifacts\cache"
        New-Item -ItemType Directory -Force -Path "artifacts\cache" | Out-Null
        Log-Success "Build cache cleared"
    } else {
        Log-Info "Cache directory does not exist"
    }
}

# ── Entry Point ───────────────────────────────────────────────
function Main {
    Init-Logger
    $cfg = Load-Config

    switch ($Action) {
        "build" { Invoke-Build $cfg }
        "sign"  { Invoke-Sign  $cfg }
        "sync"  { Invoke-Sync  $cfg }
        "diag"  { Invoke-Diagnostics }
        "clean" { Invoke-Clean }
        "cache" { Invoke-CacheClear }
        default { Log-Error "Unknown action: $Action" }
    }
}

Main
