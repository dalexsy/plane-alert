@echo off
REM Deploy AeroAPI Integration to Firebase Functions
echo ========================================
echo   AeroAPI Integration Deployment
echo ========================================
echo.

REM Check if Firebase CLI is available
where firebase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Firebase CLI not found. Please install it first.
    echo   npm install -g firebase-tools
    exit /b 1
)

echo Step 1: Setting AeroAPI Key...
cd functions
firebase functions:config:set aeroapi.key="tlgsmPPCIsgFIG0T6VjlgjEguCImDEXi"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to set Firebase config
    cd ..
    exit /b 1
)

echo.
echo Step 2: Verifying configuration...
firebase functions:config:get
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to read Firebase config
    cd ..
    exit /b 1
)

cd ..

echo.
echo Step 3: Building shared package...
cd shared
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build shared package
    cd ..
    exit /b 1
)
cd ..

echo.
echo Step 4: Deploying functions...
call npm run deploy:functions
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Deployment failed
    exit /b 1
)

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Wait 1-2 minutes for new aircraft to appear
echo 2. Check notifications for route info (e.g., "RDU→IAD (ETA 21:16 UTC)")
echo 3. Monitor costs at: https://www.flightaware.com/aeroapi/portal
echo.
echo Expected monthly cost: $3-6 (based on 20-40 new aircraft/day)
echo Budget limit: $10/month free credit
echo.
pause
