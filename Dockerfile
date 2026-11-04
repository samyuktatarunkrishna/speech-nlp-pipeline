FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 1000 appuser
WORKDIR /app

# CPU wheels avoid installing large CUDA libraries on CPU hosting.
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser . .
ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/home/appuser/.cache/huggingface \
    OMP_NUM_THREADS=2 \
    TOKENIZERS_PARALLELISM=false
USER appuser
EXPOSE 7860
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
