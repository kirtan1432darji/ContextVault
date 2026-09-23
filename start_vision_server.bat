@echo off
title ContextVault - Local Vision AI Server (RTX 4050)
cd /d "c:\Kirtan_Darji\AI_Projects\ContextVault"
echo ========================================================
echo   ContextVault Local Vision AI Server (Qwen2.5-VL-3B)
echo   Hardware: NVIDIA GeForce RTX 4050 Laptop GPU (6GB VRAM)
echo   Quantization: 4-bit NF4 via bitsandbytes (~2.5GB VRAM)
echo   Listening on: http://0.0.0.0:8001
echo ========================================================
python scripts/standalone_vision_server.py
pause
