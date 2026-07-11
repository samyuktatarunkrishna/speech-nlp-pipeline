import whisper
import logging

logger = logging.getLogger(__name__)

# Cache loaded models in memory
_models = {}

def get_whisper_model(model_name: str = "base"):
    """
    Returns a cached instance of the Whisper model, loading it if necessary.
    """
    if model_name not in _models:
        logger.info(f"Loading Whisper model '{model_name}' into memory...")
        # load_model automatically checks for CUDA/MPS or defaults to CPU
        _models[model_name] = whisper.load_model(model_name)
    return _models[model_name]

def transcribe_audio(audio_path: str, model_name: str = "base") -> dict:
    """
    Transcribes audio using OpenAI Whisper and returns structured segments.
    """
    try:
        model = get_whisper_model(model_name)
        logger.info(f"Transcribing audio file: {audio_path}...")
        result = model.transcribe(audio_path, verbose=False)
        
        segments = []
        for seg in result.get("segments", []):
            segments.append({
                "id": seg.get("id"),
                "start": seg.get("start"),
                "end": seg.get("end"),
                "text": seg.get("text", "").strip()
            })
            
        return {
            "text": result.get("text", ""),
            "language": result.get("language", "en"),
            "segments": segments
        }
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        raise e
