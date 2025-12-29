@echo off
REM Enhanced gradle wrapper fix for Windows

echo.
echo ================================================
echo   Fixing Gradle Wrapper JAR
echo ================================================
echo.

setlocal enabledelayedexpansion

REM Get the gradle version from gradle-wrapper.properties
set "GRADLE_PROPS=android\gradle\wrapper\gradle-wrapper.properties"
set "GRADLE_VERSION="

if exist "!GRADLE_PROPS!" (
    echo ✅ Found gradle-wrapper.properties
    
    REM Extract gradle version from properties file
    for /f "tokens=2 delims==" %%A in ('findstr /R "^distributionUrl" "!GRADLE_PROPS!"') do (
        REM Extract version from URL like gradle-8.13.0-all.zip
        for /f "tokens=2 delims=-" %%B in ('echo %%A') do (
            for /f "tokens=1 delims=-" %%C in ('echo %%B') do (
                set "GRADLE_VERSION=%%C"
            )
        )
    )
) else (
    echo ❌ gradle-wrapper.properties not found
    exit /b 1
)

echo Current Gradle Version: !GRADLE_VERSION!

REM Create gradle wrapper directory if it doesn't exist
if not exist "android\gradle\wrapper" (
    echo Creating gradle\wrapper directory...
    mkdir android\gradle\wrapper
)

REM Remove corrupt jar if it exists
if exist "android\gradle\wrapper\gradle-wrapper.jar" (
    echo Removing corrupt gradle-wrapper.jar...
    del "android\gradle\wrapper\gradle-wrapper.jar"
)

echo.
echo Attempting to download gradle-wrapper.jar...
echo.

REM Try method 1: Use gradlew.bat wrapper script
cd android

if exist "gradlew.bat" (
    echo Running gradlew wrapper download...
    call gradlew.bat wrapper
    
    if %ERRORLEVEL% equ 0 (
        echo ✅ Gradle wrapper initialized successfully!
        cd ..
        exit /b 0
    )
)

REM If that fails, try calling gradlew clean which auto-downloads
echo Running gradlew clean (will download jar if missing)...
call gradlew.bat clean

if %ERRORLEVEL% equ 0 (
    echo ✅ Gradle wrapper jar downloaded!
    cd ..
    exit /b 0
) else (
    echo ❌ Gradle wrapper download failed
    echo.
    echo Please ensure Java is installed:
    echo   https://www.oracle.com/java/technologies/downloads/
    cd ..
    exit /b 1
)
