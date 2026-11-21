@echo off
setlocal
cd /d "%~dp0.."
echo Running the seven focused browser suites. Please wait for the result.
"%APPDATA%\nvm\v24.20.0\node.exe" scripts/runBrowserTests.mjs image-recovery-owner workbench-shape-tools workbench-inspection-keyboard reception-gutter-pixels single-toolbar workbench-image-tools workbench-shared-tools > "%TEMP%\inscape-publish-focused-browser.log" 2>&1
set "INSCAPE_TEST_EXIT=%ERRORLEVEL%"
echo Browser checks finished. Exit code: %INSCAPE_TEST_EXIT%
echo Log: %TEMP%\inscape-publish-focused-browser.log
exit /b %INSCAPE_TEST_EXIT%
