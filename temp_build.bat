@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "GRADLE_OPTS=-Xmx8g -XX:+UseG1GC -Dfile.encoding=UTF-8"
echo Using JBR at %JAVA_HOME%
echo GRADLE_OPTS is %GRADLE_OPTS%
call gradlew.bat --stop
call gradlew.bat :app:assembleRelease --no-daemon --info
pause
