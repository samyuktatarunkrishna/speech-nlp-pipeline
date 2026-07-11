import os
import json
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "database.json")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if not os.path.exists(DB_PATH):
        with open(DB_PATH, "w") as f:
            json.dump({}, f)

def get_history() -> list:
    """
    Returns a summary list of all runs in the database, ordered by timestamp.
    """
    init_db()
    try:
        with open(DB_PATH, "r") as f:
            db = json.load(f)
        
        history = []
        for run_id, run in db.items():
            # Return summary without raw embeddings or huge lists of segments to keep payload small
            history.append({
                "id": run_id,
                "title": run.get("title", "Unknown Title"),
                "uploader": run.get("uploader", "Unknown Uploader"),
                "duration": run.get("duration", 0),
                "url": run.get("url", ""),
                "timestamp": run.get("timestamp", ""),
                "overall_sentiment": run.get("overall_sentiment", {}),
                "language": run.get("language", "en")
            })
        
        # Sort by timestamp descending
        history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return history
    except Exception as e:
        logger.error(f"Error reading database: {e}")
        return []

def get_run(run_id: str) -> dict:
    """
    Returns the full run details for a given run ID.
    """
    init_db()
    try:
        with open(DB_PATH, "r") as f:
            db = json.load(f)
        return db.get(run_id)
    except Exception as e:
        logger.error(f"Error reading run {run_id} from database: {e}")
        return None

def save_run(run_id: str, run_data: dict):
    """
    Saves or updates a run in the database.
    """
    init_db()
    try:
        with open(DB_PATH, "r") as f:
            db = json.load(f)
        
        db[run_id] = run_data
        
        with open(DB_PATH, "w") as f:
            json.dump(db, f, indent=2)
        logger.info(f"Successfully saved run {run_id} to database.")
    except Exception as e:
        logger.error(f"Error saving run {run_id} to database: {e}")
        raise e

def delete_run(run_id: str) -> bool:
    """
    Deletes a run from the database.
    """
    init_db()
    try:
        with open(DB_PATH, "r") as f:
            db = json.load(f)
        
        if run_id in db:
            del db[run_id]
            with open(DB_PATH, "w") as f:
                json.dump(db, f, indent=2)
            logger.info(f"Deleted run {run_id} from database.")
            return True
        return False
    except Exception as e:
        logger.error(f"Error deleting run {run_id} from database: {e}")
        return False
