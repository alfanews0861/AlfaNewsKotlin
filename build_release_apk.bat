@echo off
setlocal

REM Use Java 17 for compatibility
set "JBR_PATH=C:\Eclipse\jdk-17.0.16.8-hotspot"
if exist "%JBR_PATH%\bin\java.exe" (
    set "JAVA_HOME=%JBR_PATH%"
    echo Using JBR from: %JBR_PATH%
) else (
    echo JBR not found at %JBR_PATH%. Please ensure Android Studio is installed.
    exit /b 1
)

REM Use 3GB of RAM for the build to support R8 minification
set "GRADLE_OPTS=-Xmx3g -Dfile.encoding=UTF-8"

echo Stopping any existing Gradle daemons...
call gradlew.bat --stop

echo Building signed release APK and AAB with Java 21 and R8...
call gradlew.bat clean :app:assembleRelease :app:bundleRelease --no-daemon

echo.
echo If the build succeeded, you can find the outputs at:
echo APK: app\build\outputs\apk\release\app-release.apk
echo AAB: app\build\outputs\bundle\release\app-release.aab
REM Removed pause for automated build
