import numpy as np
from transformers import pipeline
from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger(__name__)

_sentiment_pipeline = None
_embedding_model = None

def get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        logger.info("Loading sentiment analysis pipeline...")
        try:
            # cardiffnlp/twitter-roberta-base-sentiment-latest is a robust 3-class sentiment model
            _sentiment_pipeline = pipeline(
                "sentiment-analysis", 
                model="cardiffnlp/twitter-roberta-base-sentiment-latest",
                device=-1
            )
        except Exception as e:
            logger.warning(f"Failed to load twitter-roberta model: {e}. Falling back to default pipeline.")
            try:
                _sentiment_pipeline = pipeline("sentiment-analysis", device=-1)
            except Exception as ex:
                logger.error(f"Failed to load fallback sentiment pipeline: {ex}")
                _sentiment_pipeline = None
    return _sentiment_pipeline

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        logger.info("Loading SentenceTransformer model...")
        # all-MiniLM-L6-v2 is small (~90MB), fast, and very accurate
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model

def analyze_sentiment_batch(texts: list[str]) -> list[dict]:
    """
    Analyzes sentiment for a list of texts and returns structured outputs.
    """
    nlp = get_sentiment_pipeline()
    if nlp is None:
        return [{"label": "NEUTRAL", "confidence": 1.0, "score": 0.0} for _ in texts]
        
    try:
        # Run batch analysis
        results = nlp(texts)
        formatted_results = []
        for res in results:
            raw_label = res["label"].upper()
            score = res["score"]
            
            # Map standard roberta, default distilbert, or raw labels to POSITIVE, NEUTRAL, NEGATIVE
            if "POSITIVE" in raw_label or "POS" in raw_label or raw_label == "LABEL_2":
                category = "POSITIVE"
                sentiment_score = score
            elif "NEGATIVE" in raw_label or "NEG" in raw_label or raw_label == "LABEL_0":
                category = "NEGATIVE"
                sentiment_score = -score
            elif "NEUTRAL" in raw_label or "NEU" in raw_label or raw_label == "LABEL_1":
                category = "NEUTRAL"
                sentiment_score = 0.0
            else:
                # Default mapping for binary sentiment models (like default distilbert sst-2)
                # Map based on label directly, treating neutral as absent
                if raw_label == "LABEL_0" or "NEG" in raw_label:
                    category = "NEGATIVE"
                    sentiment_score = -score
                else:
                    category = "POSITIVE"
                    sentiment_score = score
                    
            formatted_results.append({
                "label": category,
                "confidence": score,
                "score": sentiment_score  # -1.0 to +1.0 scale
            })
        return formatted_results
    except Exception as e:
        logger.error(f"Error in batch sentiment analysis: {e}")
        # Return fallback neutral results
        return [{"label": "NEUTRAL", "confidence": 1.0, "score": 0.0} for _ in texts]

def compute_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Computes sentence embeddings for a list of texts.
    """
    try:
        model = get_embedding_model()
        embeddings = model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()
    except Exception as e:
        logger.error(f"Error computing embeddings: {e}")
        return [[] for _ in texts]

def cosine_similarity(a, b):
    a = np.array(a)
    b = np.array(b)
    if len(a) == 0 or len(b) == 0:
        return 0.0
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))
