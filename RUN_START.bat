@echo off
title KHOI CHAY BANG THEO DOI TIEN DO PHAP LY - BINH QUOI THANH DA
chcp 65001 > nul

echo ===================================================================
echo   DANG KHOI CHAY BANG THEO DOI TIEN DO PHAP LY (BINH QUOI - THANH DA)
echo ===================================================================
echo.

:: Kiem tra Python tren may
where python >nul 2>nul
if %errorlevel% == 0 (
    echo [OK] Tim thay Python. Dang dong bo du lieu moi nhat tu Google Sheet...
    python "%~dp0sync_sheet.py"
    echo.
    echo [OK] Dang khoi chay Local Web Server tren cong 8080...
    echo [OK] Dang mo trang web tren Trinh duyet...
    start "" "http://localhost:8080"
    python -m http.server 8080
) else (
    echo [OK] Mo truc tiep trang web tren Trinh duyet Mac dinh...
    start "" "%~dp0index.html"
)

