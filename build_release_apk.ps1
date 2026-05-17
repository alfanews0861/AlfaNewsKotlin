# Build Release APK with automatic retry on failure
$maxRetries = 10
$retryCount = 0
$success = $false

# Kill any existing Java processes
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Set Java 21 (from Android Studio JBR)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio1\jbr"
$env:GRADLE_OPTS = "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC"

while ($retryCount -lt $maxRetries -and -not $success) {
    $retryCount++
    Write-Host "Release build attempt $retryCount of $maxRetries..." -ForegroundColor Yellow
    
    # Kill any Java processes before starting
    Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    
    # Run the build
    $buildOutput = .\gradlew.bat assembleRelease --no-daemon --no-build-cache --max-workers=1 2>&1
    
    # Check if APK was created
    $apkPath = "app\build\outputs\apk\release\app-release.apk"
    if (Test-Path $apkPath) {
        Write-Host "`n✅ SUCCESS! Release APK built successfully!" -ForegroundColor Green
        Write-Host "Location: $apkPath" -ForegroundColor Cyan
        Write-Host "APK Size: $([math]::Round((Get-Item $apkPath).Length / 1MB, 2)) MB" -ForegroundColor Green
        $success = $true
        break
    }
    
    # Check if it's a daemon crash
    if ($buildOutput -match "daemon disappeared" -or $buildOutput -match "JVM crash" -or $buildOutput -match "Kotlin daemon") {
        Write-Host "Build crashed, retrying immediately..." -ForegroundColor Red
        Start-Sleep -Seconds 2
        continue
    }
    
    # If it's a different error, show it
    Write-Host "Build failed. Last 30 lines:" -ForegroundColor Red
    $buildOutput | Select-Object -Last 30
    Start-Sleep -Seconds 2
}

if (-not $success) {
    Write-Host "`n❌ Failed to build Release APK after $maxRetries attempts." -ForegroundColor Red
    exit 1
}

exit 0
