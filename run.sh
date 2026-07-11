#!/bin/bash

# Speech-to-Text NLP Pipeline Runner Script
set -e

# Base directory of the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=============================================="
echo " Starting SpeechInsight NLP Analysis Dashboard"
echo "=============================================="

# Check if required libraries are available in python
python3 -c "
import fastapi
import uvicorn
import yt_dlp
import whisper
import transformers
import sentence_transformers
print('✓ All python dependencies verified!')
" || {
  echo "Error: Python dependencies are missing. Run: pip3 install -r requirements.txt"
  exit 1
}

# Start the uvicorn server
echo "Starting backend API server at http://127.0.0.1:8000"
echo "Open your browser and navigate to http://127.0.0.1:8000 to access the UI."
echo "Press Ctrl+C to stop the server."
echo "----------------------------------------------"

python3 -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
