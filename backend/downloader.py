import os
import yt_dlp
import logging

logger = logging.getLogger(__name__)

def download_youtube_audio(url: str, output_dir: str) -> dict:
    """
    Downloads audio from a YouTube URL and returns info metadata and final audio path.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(output_dir, '%(id)s.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info.get("id", "unknown")
            title = info.get("title", "Unknown Title")
            duration = info.get("duration", 0)
            uploader = info.get("uploader", "Unknown Uploader")
            thumbnail = info.get("thumbnail", "")
            
            filename = ydl.prepare_filename(info)
            base, _ = os.path.splitext(filename)
            audio_path = f"{base}.mp3"
            
            return {
                "id": video_id,
                "title": title,
                "duration": duration,
                "uploader": uploader,
                "thumbnail": thumbnail,
                "audio_path": audio_path,
                "url": url
            }
    except Exception as e:
        logger.error(f"Error downloading YouTube video: {e}")
        raise e
