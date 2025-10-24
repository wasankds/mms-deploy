

@echo off
REM Start your Node.js app with PM2

@REM REM Change directory to your app folder
@REM cd /d D:\aWK_LeaseSystem\MPOS

REM Start the app using PM2 (replace app.js with your entry file)
pm2 start mpos.js -i 0

REM Optional: Show PM2 process list
pm2 list

pause