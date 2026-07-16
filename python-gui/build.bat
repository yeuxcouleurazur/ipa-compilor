@echo off
echo Installing requirements...
pip install -r requirements.txt

echo.
echo Building IPA Compilor Standalone Executable...
pyinstaller --noconfirm --onedir --windowed --name "IPA_Compilor" app.py

echo.
echo Build complete! You can find the executable in python-gui\dist\IPA_Compilor
pause
