@echo off
chcp 65001 > nul
title Y2Downloader - YouTube Video & Music Downloader
color 0A

echo =====================================================================
echo    Y2Downloader - Cong cu tai Video va Nhac YouTube (Tuong tu Y2Mate)
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
