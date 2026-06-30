@echo off
chcp 65001 > nul
title WPGateway Yönetim Paneli
color 0A

echo ===================================================
echo             DOCKER KONTROLÜ YAPILIYOR
echo ===================================================
docker info >nul 2>&1
if %errorlevel% equ 0 goto menu

echo [!] Docker daemonu çalışmıyor. Docker Desktop başlatılıyor...
if not exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    echo.
    echo [HATA] Docker Desktop bilgisayarınızda varsayılan dizinde bulunamadı!
    echo Lütfen Docker Desktop'ı yükleyin veya el ile çalıştırıp bu betiği tekrar açın.
    pause
    exit
)

start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo [*] Docker Desktop uygulamasının açılması bekleniyor...

set retry=0
:wait_loop
timeout /t 3 >nul
docker info >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo [+] Docker başarıyla bağlandı!
    timeout /t 2 >nul
    goto menu
)
set /a retry+=1
if %retry% geq 20 (
    echo.
    echo [HATA] Docker Desktop başlatılamadı veya çok yavaş açılıyor. 
    echo Lütfen Docker Desktop uygulamasını el ile açıp bu betiği tekrar çalıştırın.
    pause
    exit
)
echo [*] Bağlantı deneniyor (%retry%/20)...
goto wait_loop

:menu
cls
echo ===================================================
echo             WPGATEWAY YÖNETİM PANELİ
echo ===================================================
echo  [1] Sistemi Başlat (Start Gateway)
echo  [2] Sistemi Durdur (Stop Gateway)
echo  [3] Sistemi Yeniden Başlat (Restart Gateway)
echo  [4] Canlı Günlükleri İzle (Show Logs)
echo  [5] Yeniden Derle ve Başlat (Rebuild and Start)
echo  [6] Çalışan Servislerin Durumu (Check Status)
echo  [7] Çıkış (Exit)
echo ===================================================
set /p secim="Seçiminiz (1-7): "

if "%secim%"=="1" goto start
if "%secim%"=="2" goto stop
if "%secim%"=="3" goto restart
if "%secim%"=="4" goto logs
if "%secim%"=="5" goto rebuild
if "%secim%"=="6" goto status
if "%secim%"=="7" goto exit
echo Geçersiz seçim, tekrar deneyin.
pause
goto menu

:start
echo.
echo [+] WPGateway başlatılıyor...
docker compose up -d
echo [+] Sistem başarıyla arka planda başlatıldı!
echo [+] Kontrol Paneline erişmek için tarayıcınızda: http://localhost:8000 adresini açın.
echo.
pause
goto menu

:stop
echo.
echo [-] WPGateway durduruluyor...
docker compose down
echo [-] Tüm servisler durduruldu.
echo.
pause
goto menu

:restart
echo.
echo [*] WPGateway yeniden başlatılıyor...
docker compose restart
echo [*] Yeniden başlatıldı.
echo.
pause
goto menu

:logs
echo.
echo [*] Canlı günlükler gösteriliyor. Çıkmak için CTRL+C tuşlarına basın...
docker compose logs -f
goto menu

:rebuild
echo.
echo [+] WPGateway kodları güncelleniyor ve yeniden derleniyor...
docker compose up --build -d
echo [+] Başarıyla güncellendi ve başlatıldı!
echo.
pause
goto menu

:status
echo.
echo [*] Çalışan servisler:
docker compose ps
echo.
pause
goto menu

:exit
echo.
echo WPGateway'i kullandığınız için teşekkürler! İyi çalışmalar.
timeout /t 3 >nul
exit
