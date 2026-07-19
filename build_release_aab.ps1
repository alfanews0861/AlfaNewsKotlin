# Build Release AAB with automatic retry on failure
$maxRetries = 10
$retryCount = 0
$success = $false

# Kill any existing Java processes
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Set Java 17 (from Eclipse Temurin JDK for compatibility)
$env:JAVA_HOME = "C:\Eclipse\jdk-17.0.16.8-hotspot"
$env:GRADLE_OPTS = "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC"

while ($retryCount -lt $maxRetries -and -not $success) {
    $retryCount++
    Write-Host "Release bundle build attempt $retryCount of $maxRetries..." -ForegroundColor Yellow

    # Kill any Java processes before starting
    Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    # Run the build
    # Using --no-daemon to avoid persistent crashes in the same process
    # Redirecting output to a file so we can monitor it if needed
    .\gradlew.bat clean :app:bundleRelease --no-daemon --no-build-cache --max-workers=1 | Out-Default

    # Check if AAB was created
    $aabPath = "app\build\outputs\bundle\release\app-release.aab"
    if (Test-Path $aabPath) {
        Write-Host "`n✅ SUCCESS! Release Bundle built successfully!" -ForegroundColor Green
        Write-Host "Location: $aabPath" -ForegroundColor Cyan
        Write-Host "AAB Size: $([math]::Round((Get-Item $aabPath).Length / 1MB, 2)) MB" -ForegroundColor Green
        $success = $true
        break
    }

    Write-Host "Build failed or crashed, retrying..." -ForegroundColor Red
    Start-Sleep -Seconds 2
}

if (-not $success) {
    Write-Host "`n❌ Failed to build Release Bundle after $maxRetries attempts." -ForegroundColor Red
    exit 1
}

exit 0
