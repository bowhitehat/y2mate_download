"""
Downloader engine for YouTube Video & Audio (Y2Mate Alternative)
Powered by yt-dlp and ffmpeg
"""

import os
import sys
import re
import time
import shutil
import threading
import uuid
import yt_dlp
import imageio_ffmpeg

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_DIR = os.path.join(BASE_DIR, "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# In-memory download tasks tracker
tasks = {}
tasks_lock = threading.Lock()


def get_ffmpeg_path():
    """Locate ffmpeg directory or executable on the system."""
    # 1. Check if ffmpeg is in system PATH
    sys_ffmpeg = shutil.which("ffmpeg")
    if sys_ffmpeg:
        return os.path.dirname(sys_ffmpeg)

    # 2. Check imageio_ffmpeg bundled binary
    try:
        bundled_exe = imageio_ffmpeg.get_ffmpeg_exe()
        bundled_dir = os.path.dirname(bundled_exe)
        dest_exe = os.path.join(bundled_dir, "ffmpeg.exe")
        if not os.path.exists(dest_exe):
            shutil.copy2(bundled_exe, dest_exe)
        return bundled_dir
    except Exception as e:
        print(f"[FFmpeg Warning] Could not set up imageio_ffmpeg: {e}")
        return None


FFMPEG_DIR = get_ffmpeg_path()


def format_bytes(size):
    """Format bytes to human readable string (KB, MB, GB)."""
    if not size or size <= 0:
        return "N/A"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} TB"


def format_duration(seconds):
    """Format duration in seconds to MM:SS or HH:MM:SS."""
    if not seconds:
        return "00:00"
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def format_views(views):
    """Format view count in a readable way."""
    if not views:
        return "0 lượt xem"
    if views >= 1_000_000_000:
        return f"{views / 1_000_000_000:.1f} tỷ lượt xem"
    if views >= 1_000_000:
        return f"{views / 1_000_000:.1f} triệu lượt xem"
    if views >= 1_000:
        return f"{views / 1_000:.1f} nghìn lượt xem"
    return f"{views} lượt xem"


def is_url(text):
    """Check if the given text is a URL or search keyword."""
    if not text:
        return False
    text = text.strip()
    return bool(re.match(r'^(https?://|www\.|youtu\.be|youtube\.com)', text, re.IGNORECASE))


def search_youtube(query, max_results=10):
    """Search YouTube for videos matching query."""
    ydl_opts = {
        'socket_timeout': 15,
        'retries': 1,
        'extractor_retries': 1,
        'quiet': True,
        'extract_flat': True,
        'skip_download': True,
        'js_runtimes': {'node': {}},
        'remote_components': ['ejs:github'],
    }
    if FFMPEG_DIR:
        ydl_opts['ffmpeg_location'] = FFMPEG_DIR

    results = []
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        search_query = f"ytsearch{max_results}:{query}"
        info = ydl.extract_info(search_query, download=False)
        entries = info.get('entries', []) or []
        for entry in entries:
            video_id = entry.get('id')
            if not video_id:
                continue
            duration = entry.get('duration') or 0
            thumbnails = entry.get('thumbnails') or []
            thumb_url = thumbnails[-1].get('url') if thumbnails else f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
            
            results.append({
                'id': video_id,
                'title': entry.get('title', 'Video không có tiêu đề'),
                'url': f"https://www.youtube.com/watch?v={video_id}",
                'duration': duration,
                'duration_formatted': format_duration(duration),
                'uploader': entry.get('uploader') or entry.get('channel') or 'YouTube',
                'view_count': format_views(entry.get('view_count')),
                'thumbnail': thumb_url,
            })
    return results


def get_video_info(url):
    """Extract metadata and available video/audio formats for a YouTube URL."""
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'js_runtimes': {'node': {}},
        'remote_components': ['ejs:github'],
    }
    if FFMPEG_DIR:
        ydl_opts['ffmpeg_location'] = FFMPEG_DIR

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    title = info.get('title', 'YouTube Video')
    duration = info.get('duration', 0)
    video_id = info.get('id', '')
    uploader = info.get('uploader') or info.get('channel') or 'YouTube'
    uploader_url = info.get('uploader_url') or (f"https://www.youtube.com/channel/{info.get('channel_id')}" if info.get('channel_id') else '')
    thumbnail = info.get('thumbnail') or f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg"
    view_count = format_views(info.get('view_count'))
    upload_date = info.get('upload_date')
    if upload_date and len(upload_date) == 8:
        upload_date = f"{upload_date[6:8]}/{upload_date[4:6]}/{upload_date[0:4]}"

    formats = info.get('formats', []) or []

    # Find best standalone audio format for size estimation
    best_audio_size = 0
    best_audio_abr = 128
    for f in formats:
        if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
            size = f.get('filesize') or f.get('filesize_approx') or 0
            if size > best_audio_size:
                best_audio_size = size
            abr = f.get('abr') or 0
            if abr > best_audio_abr:
                best_audio_abr = abr

    if best_audio_size == 0 and duration > 0:
        best_audio_size = int((best_audio_abr * 1000 / 8) * duration)

    # 1. Video options (MP4)
    # Available resolutions in descending order
    standard_resolutions = [
        (2160, '4K UHD (2160p)'),
        (1440, '2K QHD (1440p)'),
        (1080, 'Full HD (1080p)'),
        (720,  'HD (720p)'),
        (480,  'SD (480p)'),
        (360,  'SD (360p)'),
        (240,  'Tiết kiệm (240p)'),
        (144,  'Thấp nhất (144p)')
    ]

    available_videos = []
    seen_heights = set()

    for h, label in standard_resolutions:
        # Check if any format matches this height
        matches = [f for f in formats if (f.get('height') or 0) == h and f.get('vcodec') != 'none']
        if not matches:
            continue
        
        seen_heights.add(h)
        best_match = max(matches, key=lambda x: (x.get('tbr') or x.get('vbr') or 0))
        fps = best_match.get('fps') or 30
        fps_label = f" {fps}fps" if fps > 30 else ""

        # Size estimation
        v_size = best_match.get('filesize') or best_match.get('filesize_approx') or 0
        if v_size == 0 and best_match.get('tbr') and duration > 0:
            v_size = int((best_match.get('tbr') * 1000 / 8) * duration)
        
        # Total size = video stream + audio stream
        total_size = v_size + best_audio_size if (best_match.get('acodec') == 'none') else v_size
        size_str = format_bytes(total_size)

        available_videos.append({
            'height': h,
            'label': f"{h}p{fps_label}",
            'quality_title': f"{label}{fps_label}",
            'ext': 'mp4',
            'filesize': total_size,
            'filesize_str': size_str,
            'fps': fps,
            'is_hd': h >= 720
        })

    # Fallback if no matching standard resolution found, collect whatever heights are present
    if not available_videos:
        for f in formats:
            h = f.get('height')
            if h and f.get('vcodec') != 'none' and h not in seen_heights:
                seen_heights.add(h)
                v_size = f.get('filesize') or f.get('filesize_approx') or 0
                available_videos.append({
                    'height': h,
                    'label': f"{h}p",
                    'quality_title': f"Độ phân giải {h}p",
                    'ext': 'mp4',
                    'filesize': v_size + best_audio_size,
                    'filesize_str': format_bytes(v_size + best_audio_size),
                    'fps': f.get('fps', 30),
                    'is_hd': h >= 720
                })
        available_videos.sort(key=lambda x: x['height'], reverse=True)

    # 2. Audio options (MP3 & Original)
    audio_bitrates = [
        (320, 'MP3 Cực nét (320 kbps)', 'Chất lượng cao nhất cho tai nghe & loa cao cấp'),
        (256, 'MP3 Chuẩn cao (256 kbps)', 'Chất lượng âm thanh phòng thu rõ nét'),
        (192, 'MP3 Tiêu chuẩn (192 kbps)', 'Cân bằng hoàn hảo giữa dung lượng và âm thanh'),
        (128, 'MP3 Dung lượng nhẹ (128 kbps)', 'Tối ưu dung lượng cho điện thoại, thẻ nhớ')
    ]

    available_audios = []
    for br, audio_title, desc in audio_bitrates:
        approx_size = int((br * 1000 / 8) * duration) if duration > 0 else 0
        available_audios.append({
            'type': 'mp3',
            'bitrate': br,
            'label': f"{br} kbps",
            'quality_title': audio_title,
            'description': desc,
            'ext': 'mp3',
            'filesize': approx_size,
            'filesize_str': format_bytes(approx_size)
        })

    # Original audio stream (M4A)
    m4a_matches = [f for f in formats if f.get('ext') == 'm4a' and f.get('vcodec') == 'none']
    if m4a_matches:
        best_m4a = max(m4a_matches, key=lambda x: (x.get('abr') or 0))
        m4a_size = best_m4a.get('filesize') or best_m4a.get('filesize_approx') or best_audio_size
        available_audios.append({
            'type': 'm4a',
            'bitrate': int(best_m4a.get('abr') or 128),
            'label': f"M4A ({int(best_m4a.get('abr') or 128)} kbps)",
            'quality_title': 'Audio gốc M4A (Không nén lại)',
            'description': 'Tải trực tiếp âm thanh gốc của YouTube, cực nhanh trong vài giây',
            'ext': 'm4a',
            'filesize': m4a_size,
            'filesize_str': format_bytes(m4a_size)
        })

    return {
        'id': video_id,
        'title': title,
        'url': f"https://www.youtube.com/watch?v={video_id}",
        'duration': duration,
        'duration_formatted': format_duration(duration),
        'uploader': uploader,
        'uploader_url': uploader_url,
        'thumbnail': thumbnail,
        'view_count': view_count,
        'upload_date': upload_date or "N/A",
        'videos': available_videos,
        'audios': available_audios
    }


def sanitize_filename(title):
    """Sanitize title for safe Windows filenames."""
    # Replace invalid Windows filename characters: \ / : * ? " < > |
    clean = re.sub(r'[\\/*?:"<>|]', "", title)
    clean = clean.strip().rstrip('. ')
    return clean[:120] if clean else "youtube_download"


def run_download_task(task_id, url, dl_type, quality, ext):
    """Worker function that runs inside a background thread for downloading."""
    task = tasks[task_id]
    task['status'] = 'downloading'
    task['started_at'] = time.time()

    def progress_hook(d):
        if d['status'] == 'downloading':
            downloaded = d.get('downloaded_bytes') or 0
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            speed = d.get('speed') or 0
            eta = d.get('eta') or 0

            pct = 0.0
            if total > 0:
                pct = round((downloaded / total) * 100, 1)
            elif d.get('_percent_str'):
                try:
                    pct = float(d.get('_percent_str').replace('%', '').strip())
                except Exception:
                    pass

            with tasks_lock:
                task['progress'] = min(pct, 98.0)
                task['speed_str'] = format_bytes(speed) + "/s" if speed else "Đang tính..."
                task['eta_str'] = format_duration(eta) if eta else "..."
                task['downloaded_str'] = format_bytes(downloaded)
                task['total_str'] = format_bytes(total) if total else "Đang tải..."
                if task['status'] != 'processing':
                    task['status_text'] = f"Đang tải xuống... {pct:.1f}% ({task['speed_str']})"

        elif d['status'] == 'finished':
            with tasks_lock:
                task['progress'] = 98.0
                task['status'] = 'processing'
                task['status_text'] = "Đang hoàn thiện và xử lý file (FFmpeg)..."

    def postprocessor_hook(d):
        with tasks_lock:
            task['status'] = 'processing'
            pp_name = d.get('postprocessor') or ''
            if 'ExtractAudio' in pp_name:
                task['status_text'] = "Đang chuyển đổi âm thanh MP3 chất lượng cao..."
            elif 'Merger' in pp_name:
                task['status_text'] = "Đang ghép hình ảnh và âm thanh vào MP4..."
            else:
                task['status_text'] = "Đang hoàn tất xử lý định dạng..."

    # Configure output template
    # Format outtmpl to prevent conflicts and ensure clean names
    timestamp = int(time.time())
    out_template = os.path.join(DOWNLOAD_DIR, f"%(title).80s [{task_id[:6]}].%(ext)s")

    ydl_opts = {
        'outtmpl': out_template,
        'progress_hooks': [progress_hook],
        'postprocessor_hooks': [postprocessor_hook],
        'quiet': True,
        'no_warnings': True,
        'js_runtimes': {'node': {}},
        'remote_components': ['ejs:github'],
    }

    if FFMPEG_DIR:
        ydl_opts['ffmpeg_location'] = FFMPEG_DIR

    try:
        if dl_type == 'audio':
            if ext == 'mp3':
                ydl_opts['format'] = 'bestaudio/best'
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': str(quality),
                }]
            else:
                # Direct original audio stream (m4a)
                ydl_opts['format'] = 'bestaudio[ext=m4a]/bestaudio'
        else:
            # Video download with specified resolution height
            h = int(quality) if str(quality).isdigit() else 720
            # Download best video up to height h and best audio, then merge to mp4
            ydl_opts['format'] = f"bestvideo[height<={h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={h}]+bestaudio/best[height<={h}]/best"
            ydl_opts['merge_output_format'] = 'mp4'

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            extracted = ydl.extract_info(url, download=True)
            task['title'] = extracted.get('title', 'YouTube Media')

        # Find the produced file in DOWNLOAD_DIR with task_id[:6]
        pattern = f"[{task_id[:6]}]"
        found_file = None
        for fname in os.listdir(DOWNLOAD_DIR):
            if pattern in fname:
                found_file = os.path.join(DOWNLOAD_DIR, fname)
                break

        if found_file and os.path.exists(found_file):
            size = os.path.getsize(found_file)
            with tasks_lock:
                task['status'] = 'finished'
                task['progress'] = 100.0
                task['filepath'] = os.path.abspath(found_file)
                task['filename'] = os.path.basename(found_file)
                task['filesize'] = size
                task['filesize_str'] = format_bytes(size)
                task['status_text'] = "🎉 Hoàn tất tải về!"
        else:
            raise Exception("Không tìm thấy file đã tải sau khi xử lý.")

    except Exception as e:
        print(f"[Download Error] Task {task_id}: {e}")
        with tasks_lock:
            task['status'] = 'error'
            task['error_message'] = str(e)
            task['status_text'] = f"Lỗi tải về: {str(e)}"


def start_download(url, dl_type, quality, ext, title_hint=""):
    """Create a download task and launch the background worker."""
    task_id = str(uuid.uuid4())
    with tasks_lock:
        tasks[task_id] = {
            'id': task_id,
            'url': url,
            'type': dl_type,
            'quality': quality,
            'ext': ext,
            'title': title_hint or 'YouTube Media',
            'status': 'queued',
            'status_text': 'Đang kết nối đến YouTube...',
            'progress': 0.0,
            'speed_str': '0 KB/s',
            'eta_str': '00:00',
            'downloaded_str': '0 B',
            'total_str': '0 B',
            'filename': '',
            'filepath': '',
            'filesize': 0,
            'filesize_str': '0 B',
            'error_message': '',
            'created_at': time.time()
        }

    thread = threading.Thread(target=run_download_task, args=(task_id, url, dl_type, quality, ext), daemon=True)
    thread.start()
    return task_id


def get_task_status(task_id):
    """Get the current snapshot of a download task."""
    with tasks_lock:
        task = tasks.get(task_id)
        if not task:
            return None
        return dict(task)


def list_downloaded_files():
    """List all files in the downloads directory."""
    items = []
    if not os.path.exists(DOWNLOAD_DIR):
        return items

    for name in os.listdir(DOWNLOAD_DIR):
        path = os.path.join(DOWNLOAD_DIR, name)
        if os.path.isfile(path):
            stat = os.stat(path)
            ext = os.path.splitext(name)[1].lower().replace('.', '')
            is_audio = ext in ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac']
            items.append({
                'filename': name,
                'path': path,
                'size': stat.st_size,
                'size_str': format_bytes(stat.st_size),
                'mtime': stat.st_mtime,
                'mtime_str': time.strftime('%d/%m/%Y %H:%M', time.localtime(stat.st_mtime)),
                'is_audio': is_audio,
                'ext': ext
            })

    items.sort(key=lambda x: x['mtime'], reverse=True)
    return items
