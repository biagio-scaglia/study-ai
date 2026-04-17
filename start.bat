echo [INFO] Verificando Java...
java -version
if %errorlevel% neq 0 (
    echo [ERROR] Java non trovato. Assicurati che sia installato correttamente.
    pause
    exit /b
)

echo [INFO] Pulizia file temporanei...
if exist tmp rmdir /s /q tmp
mkdir tmp

echo [INFO] Avvio di Study Notes AI con DuckDB...
npm run dev
pause
