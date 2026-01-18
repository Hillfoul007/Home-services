@echo off
REM Fix gradle wrapper by downloading the wrapper jar

echo.
echo 🔧 Fixing gradle wrapper...
echo.

cd android

if exist "gradlew.bat" (
    echo ✅ gradlew.bat script found
    echo Running: gradlew.bat clean
    echo.
    
    REM Run clean to download wrapper
    call gradlew.bat clean
    
    if %ERRORLEVEL% equ 0 (
        echo.
        echo ✅ Gradle wrapper fixed!
        echo.
        echo Next step:
        echo   cd ..
        echo   npm run build:aab
    ) else (
        echo.
        echo ❌ Gradle clean failed
        echo Please check your Java installation:
        echo   https://www.oracle.com/java/technologies/downloads/
        exit /b 1
    )
) else (
    echo ❌ gradlew.bat script not found
    echo Make sure you're in the project root directory
    exit /b 1
)

cd ..
