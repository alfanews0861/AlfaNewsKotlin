# Build Debug APK with automatic retry on failure
$maxRetries = 10
$retryCount = 0
$success = $false

# Kill any existing Java processes
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Set Java 17
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot"
$env:GRADLE_OPTS = "-Xmx2048m -XX:MaxMetaspaceSize=256m -XX:+UseSerialGC"

# Delete old APK first to ensure fresh build
Remove-Item "app\build\outputs\apk\debug\app-debug.apk" -ErrorAction SilentlyContinue

while ($retryCount -lt $maxRetries -and -not $success) {
    $retryCount++
    Write-Host "Build attempt $retryCount of $maxRetries..." -ForegroundColor Yellow
    
    # Kill any Java processes before starting
    Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    
    # Run the clean build
    $buildOutput = .\gradlew.bat clean assembleDebug --no-daemon --no-build-cache --stacktrace 2>&1
    
    # Check if APK was created
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        Write-Host "`nSUCCESS! APK built successfully at: $apkPath" -ForegroundColor Green
        Write-Host "APK Size: $((Get-Item $apkPath).Length / 1MB) MB" -ForegroundColor Green
        $success = $true
        break
    }
    
    # Check if it's a daemon crash
    if ($buildOutput -match "daemon disappeared" -or $buildOutput -match "JVM crash") {
        Write-Host "Daemon crashed, retrying immediately..." -ForegroundColor Red
        Start-Sleep -Seconds 2
        continue
    }
    
    # If it's a different error, show it
    Write-Host "Build failed. Last 20 lines:" -ForegroundColor Red
    $buildOutput | Select-Object -Last 20
    Start-Sleep -Seconds 2
}

if (-not $success) {
    Write-Host "`nFailed to build APK after $maxRetries attempts." -ForegroundColor Red
    exit 1
}

exit 0
