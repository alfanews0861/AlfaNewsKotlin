@echo off
setlocal

REM Use native JBR JVM from Android Studio as requested
set "JBR_PATH=C:\Program Files\Android\Android Studio1\jbr"
if exist "%JBR_PATH%\bin\java.exe" (
    set "JAVA_HOME=%JBR_PATH%"
    echo Using JBR from: %JBR_PATH%
) else (
    echo JBR not found at %JBR_PATH%. Please ensure Android Studio is installed.
    exit /b 1
)

REM Use 8GB of RAM for the build to support R8 minification
set "GRADLE_OPTS=-Xmx8g -XX:+UseG1GC -Dfile.encoding=UTF-8"

echo Stopping any existing Gradle daemons...
call gradlew.bat --stop

echo Building signed release AAB with Java 21 and R8...
call gradlew.bat clean :app:bundleRelease --no-daemon

echo.
echo If the build succeeded, you can find the AAB at:
echo app\build\outputs\bundle\release\app-release.aab
pause
