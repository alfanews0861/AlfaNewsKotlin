# Build Release Signed Bundle (AAB) with low memory and automatic retry
$maxRetries = 10
$retryCount = 0
$success = $false

# Kill any existing Java processes
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Set Java 21 (from Android Studio JBR)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio1\jbr"
# LOW MEMORY SETTINGS: 2GB Max Heap
$env:GRADLE_OPTS = "-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:+UseG1GC"

while ($retryCount -lt $maxRetries -and -not $success) {
    $retryCount++
    Write-Host "Release Bundle build attempt $retryCount of $maxRetries (Low Memory Mode)..." -ForegroundColor Yellow

    # Kill any Java processes before starting
    Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    # Run the build for bundleRelease
    $buildOutput = .\gradlew.bat bundleRelease --no-daemon --no-build-cache --max-workers=1 2>&1

    # Check if AAB was created
    $bundlePath = "app\build\outputs\bundle\release\app-release.aab"
    if (Test-Path $bundlePath) {
        Write-Host "`n✅ SUCCESS! Release Signed Bundle built successfully!" -ForegroundColor Green
        Write-Host "Location: $bundlePath" -ForegroundColor Cyan
        Write-Host "Bundle Size: $([math]::Round((Get-Item $bundlePath).Length / 1MB, 2)) MB" -ForegroundColor Green
        $success = $true
        break
    }

    # Check if it's a daemon crash or memory issue
    if ($buildOutput -match "daemon disappeared" -or $buildOutput -match "JVM crash" -or $buildOutput -match "Out of memory" -or $buildOutput -match "Kotlin daemon") {
        Write-Host "Build crashed or ran out of memory, retrying..." -ForegroundColor Red
        Start-Sleep -Seconds 5
        continue
    }

    # If it's a different error, show it
    Write-Host "Build failed. Last 30 lines:" -ForegroundColor Red
    $buildOutput | Select-Object -Last 30
    Start-Sleep -Seconds 2
}

if (-not $success) {
    Write-Host "`n❌ Failed to build Release Bundle after $maxRetries attempts." -ForegroundColor Red
    exit 1
}

exit 0
