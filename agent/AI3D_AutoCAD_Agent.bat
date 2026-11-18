@echo off
title AI3D AutoCAD Agent
rem Edit OutDir below if you want DWG files somewhere else
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AI3D_AutoCAD_Agent.ps1" -OutDir "D:\Claude_Project\AI3D_DWG"
pause
