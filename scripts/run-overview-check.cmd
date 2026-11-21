@echo off
setlocal
cd /d "%~dp0.."
echo Running the overview browser suite. Please wait for the result.
"%APPDATA%\nvm\v24.20.0\node.exe" scripts/runBrowserTests.mjs workbench-overview > "%TEMP%\inscape-publish-overview-check.log" 2>&1
set "INSCAPE_TEST_EXIT=%ERRORLEVEL%"
echo Browser checks finished. Exit code: %INSCAPE_TEST_EXIT%
echo Log: %TEMP%\inscape-publish-overview-check.log
exit /b %INSCAPE_TEST_EXIT%
