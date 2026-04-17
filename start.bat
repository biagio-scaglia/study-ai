@echo off
set "JAVA_PATH=C:\Program Files\Common Files\Oracle\Java\javapath"
set "PATH=%JAVA_PATH%;%PATH%"

echo [INFO] Verificando Java...
java -version
if %errorlevel% neq 0 (
    echo [ERROR] Java non trovato. Assicurati che sia installato correttamente.
    pause
    exit /b
)

echo [INFO] Avvio di Study Notes AI in corso...
npm run dev
pause
