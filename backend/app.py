import os
import uuid
import logging
from datetime import datetime
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Import local modules
from backend.downloader import download_youtube_audio
from backend.transcriber import transcribe_audio
from backend.analyzer import analyze_sentiment_batch, compute_embeddings, cosine_similarity
from backend.database import save_run, get_history, get_run, delete_run

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Speech-to-Text NLP Pipeline API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory to save downloaded audio temporary files
TEMP_AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "audio")

# In-memory background task status tracker
tasks_status = {}

class AnalyzeRequest(BaseModel):
    url: str

class SearchRequest(BaseModel):
    run_id: str
    query: str

def background_pipeline(task_id: str, url: str):
    logger.info(f"Starting background pipeline for task {task_id} with URL {url}")
    tasks_status[task_id] = {
        "status": "processing",
        "step": "Downloading YouTube Audio...",
        "progress": 10,
        "error": None
    }
    
    audio_info = None
    try:
        # Step 1: Download Audio
        logger.info("Step 1: Downloading YouTube audio...")
        audio_info = download_youtube_audio(url, TEMP_AUDIO_DIR)
        
        tasks_status[task_id].update({
            "step": "Transcribing speech to text (Whisper)...",
            "progress": 40
        })
        
        # Step 2: Transcribe Speech
        logger.info("Step 2: Transcribing speech...")
        transcription = transcribe_audio(audio_info["audio_path"])
        
        tasks_status[task_id].update({
            "step": "Analyzing sentiment & semantic representations...",
            "progress": 70
        })
        
        # Step 3: Analyze Sentiment and Semantic Representations
        logger.info("Step 3: Analyzing sentiment and generating embeddings...")
        segments = transcription["segments"]
        
        if not segments:
            # Handle edge case where no speech was transcribed
            segments = [{"id": 0, "start": 0, "end": audio_info["duration"], "text": "No speech detected in this audio file."}]
            
        segment_texts = [seg["text"] for seg in segments]
        
        # Run batch sentiment analysis
        sentiments = analyze_sentiment_batch(segment_texts)
        
        # Run semantic embeddings
        embeddings = compute_embeddings(segment_texts)
        
        # Merge sentiment scores and embeddings into segment objects
        analyzed_segments = []
        positive_count = 0
        negative_count = 0
        neutral_count = 0
        total_sentiment_score = 0.0
        
        for i, seg in enumerate(segments):
            sent = sentiments[i]
            emb = embeddings[i]
            
            label = sent["label"]
            if label == "POSITIVE":
                positive_count += 1
            elif label == "NEGATIVE":
                negative_count += 1
            else:
                neutral_count += 1
                
            total_sentiment_score += sent["score"]
            
            analyzed_segments.append({
                "id": seg["id"],
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
                "sentiment": sent,
                "embedding": emb  # Stored to perform local semantic searches
            })
            
        total_segments = len(segments)
        overall_sentiment = {
            "positive_percentage": round((positive_count / total_segments) * 100, 1) if total_segments > 0 else 0,
            "negative_percentage": round((negative_count / total_segments) * 100, 1) if total_segments > 0 else 0,
            "neutral_percentage": round((neutral_count / total_segments) * 100, 1) if total_segments > 0 else 0,
            "average_score": round(total_sentiment_score / total_segments, 2) if total_segments > 0 else 0.0
        }
        
        # Step 4: Save structured run data
        run_data = {
            "id": task_id,
            "title": audio_info["title"],
            "uploader": audio_info["uploader"],
            "duration": audio_info["duration"],
            "url": url,
            "thumbnail": audio_info["thumbnail"],
            "timestamp": datetime.now().isoformat(),
            "language": transcription["language"],
            "overall_sentiment": overall_sentiment,
            "segments": analyzed_segments
        }
        
        save_run(task_id, run_data)
        
        tasks_status[task_id].update({
            "status": "completed",
            "step": "Pipeline complete!",
            "progress": 100,
            "result_id": task_id
        })
        logger.info(f"Task {task_id} completed successfully.")
        
    except Exception as e:
        logger.exception(f"Pipeline failed for task {task_id}: {e}")
        tasks_status[task_id].update({
            "status": "failed",
            "step": "Failed",
            "error": str(e),
            "progress": 0
        })
    finally:
        # Step 5: Clean up temporary downloaded audio files to save local disk space
        if audio_info and "audio_path" in audio_info and os.path.exists(audio_info["audio_path"]):
            try:
                os.remove(audio_info["audio_path"])
                logger.info(f"Cleaned up temporary audio file: {audio_info['audio_path']}")
            except Exception as e:
                logger.warning(f"Failed to remove temporary audio file: {e}")

@app.post("/api/analyze")
def start_analysis(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    tasks_status[task_id] = {
        "status": "pending",
        "step": "Initializing pipeline...",
        "progress": 0,
        "error": None
    }
    background_tasks.add_task(background_pipeline, task_id, req.url)
    return {"task_id": task_id}

@app.get("/api/status/{task_id}")
def get_task_status(task_id: str):
    if task_id not in tasks_status:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks_status[task_id]

@app.get("/api/history")
def get_runs_history():
    return get_history()

@app.get("/api/results/{run_id}")
def get_run_results(run_id: str):
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    # Return run without segment embeddings in detail fetch to keep response fast,
    # unless requested. Actually, let's keep embeddings in a separate key or exclude them
    # for the frontend unless they want to search. For search, we compute similarity in the backend.
    # Exclude embeddings to make rendering fast.
    response_run = run.copy()
    response_run["segments"] = [
        {k: v for k, v in seg.items() if k != "embedding"}
        for seg in run.get("segments", [])
    ]
    return response_run

@app.post("/api/search")
def search_segments(req: SearchRequest):
    run = get_run(req.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
        
    query = req.query.strip()
    if not query:
        return []
        
    # Generate embedding for query
    query_embedding = compute_embeddings([query])[0]
    if not query_embedding:
        raise HTTPException(status_code=500, detail="Could not compute semantic embedding for query")
        
    # Compute similarity against all segments
    results = []
    for seg in run.get("segments", []):
        emb = seg.get("embedding", [])
        if not emb:
            continue
        similarity = cosine_similarity(query_embedding, emb)
        results.append({
            "id": seg["id"],
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"],
            "sentiment": seg["sentiment"],
            "similarity": round(similarity, 4)
        })
        
    # Sort by similarity score descending
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results

@app.delete("/api/results/{run_id}")
def delete_run_results(run_id: str):
    success = delete_run(run_id)
    if not success:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"status": "success"}

# Serve the static frontend
# Mount static files to root "/"
# Check if frontend directory exists, create if not
frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")
os.makedirs(frontend_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
