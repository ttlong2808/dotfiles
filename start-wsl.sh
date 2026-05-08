#!/bin/bash
# Script để khởi động môi trường test trong WSL
cd "$(dirname "$0")"
echo "Đang khởi động DotMan trong môi trường WSL (Ubuntu)..."
npm run dev
