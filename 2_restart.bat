

@echo off

@REM REM Change directory to your app folder
@REM cd /d D:\aWK_LeaseSystem\MPOS

REM Start the app using PM2 (replace app.js with your entry file)
pm2 restart mpos.js

pause