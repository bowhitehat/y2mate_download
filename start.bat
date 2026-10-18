@echo off
cd /d "%~dp0"
chcp 65001 > nul
title Y2Music - Music Player and Playlists
color 0A

echo =====================================================================
echo    Y2Music - Nghe nhac, playlist va tai video YouTube
echo =====================================================================
echo.
echo Dang kiem tra moi truong Python...

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Python tren may tinh!
    echo Vui long cai dat Python tu https://www.python.org/
    pause
    exit /b
)

echo Dang khoi dong ung dung va mo trinh duyet...
python run.py

if %errorlevel% neq 0 (
    echo.
    echo [THONG BAO] Co loi khi chay ung dung hoac ban vua dong chuong trinh.
    pause
)
