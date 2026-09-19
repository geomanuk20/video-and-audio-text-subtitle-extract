import os
import urllib.request
import urllib.parse
import json
import wave
import struct
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.conf import settings
from .models import Conversion

# Try importing moviepy
try:
    # Try MoviePy 2.x import
    from moviepy import VideoFileClip
except ImportError:
    try:
        # Fallback to MoviePy 1.x import
        from moviepy.editor import VideoFileClip
    except ImportError:
        VideoFileClip = None

# Try importing speech_recognition
try:
    import speech_recognition as sr
except ImportError:
    sr = None

def index(request):
    """Renders the main dashboard."""
    conversions = Conversion.objects.all()[:15]  # Get last 15 conversions
    return render(request, 'converter_app/index.html', {'conversions': conversions})

def format_srt_time(seconds):
    """Formats float seconds to SRT time format: HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def format_vtt_time(seconds):
    """Formats float seconds to WebVTT time format: HH:MM:SS.mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

def translate_text(text, source_lang='auto', target_lang='en'):
    """Translates text using Google's free translation API."""
    if not text.strip():
        return ""
    try:
        url = "https://translate.googleapis.com/translate_a/single"
        src = source_lang.split('-')[0]
        params = {
            'client': 'gtx',
            'sl': src,
            'tl': target_lang,
            'dt': 't',
            'q': text
        }
        full_url = f"{url}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(
            full_url,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            translated_segments = []
            if data and len(data) > 0 and data[0]:
                for segment in data[0]:
                    if segment and len(segment) > 0 and segment[0]:
                        translated_segments.append(segment[0])
            return "".join(translated_segments).strip()
    except Exception as e:
        print(f"Translation failed: {e}")
        return text

def find_quiet_split_point(wav_path, start_limit, end_limit):
    """Finds the timestamp (in seconds) of the quietest 200ms window within [start_limit, end_limit]."""
    try:
        with wave.open(wav_path, 'rb') as w:
            fps = w.getframerate()
            n_channels = w.getnchannels()
            sampwidth = w.getsampwidth()
            n_frames = w.getnframes()
            
            if sampwidth != 2:
                return (start_limit + end_limit) / 2.0
            
            start_frame = int(start_limit * fps)
            end_frame = min(int(end_limit * fps), n_frames)
            
            if start_frame >= end_frame:
                return (start_limit + end_limit) / 2.0
                
            w.setpos(start_frame)
            total_frames_to_read = end_frame - start_frame
            raw_data = w.readframes(total_frames_to_read)
            
            num_samples = len(raw_data) // 2
            samples = struct.unpack(f"{num_samples}h", raw_data)
            
            if n_channels == 2:
                samples = samples[::2]
                
            window_size = int(0.2 * fps)
            if window_size <= 0:
                return (start_limit + end_limit) / 2.0
                
            min_energy = float('inf')
            best_offset_frames = 0
            
            # Step through frames in 50ms increments to find silence
            step_size = int(0.05 * fps)
            
            for offset in range(0, len(samples) - window_size, step_size):
                window_samples = samples[offset : offset + window_size]
                energy = sum(s*s for s in window_samples)
                if energy < min_energy:
                    min_energy = energy
                    best_offset_frames = offset
            
            best_split_frame = start_frame + best_offset_frames + (window_size // 2)
            return best_split_frame / float(fps)
    except Exception as e:
        print(f"Quiet split point search failed: {e}")
        return (start_limit + end_limit) / 2.0

def transcribe_audio_chunk(recognizer, chunk_path, language_code):
    """Attempts to transcribe a single audio WAV chunk using Google Speech Recognition."""
    if not sr or not recognizer:
        return ""
    try:
        with sr.AudioFile(chunk_path) as source:
            audio_data = recognizer.record(source)
            # Send chunk to Google Web Speech API
            text = recognizer.recognize_google(audio_data, language=language_code)
            return text.strip()
    except sr.UnknownValueError:
        # Speech was unintelligible
        return ""
    except Exception:
        # Return empty on other network/file issues
        return ""

@require_POST
def convert_video(request):
    """Asynchronously uploads video and extracts audio OR generates subtitles."""
    if not VideoFileClip:
        return JsonResponse({
            'success': False,
            'error': "MoviePy is not installed. Please run pip install moviepy to resolve."
        }, status=500)

    video_file = request.FILES.get('video')
    conversion_type = request.POST.get('type', 'audio')  # 'audio' or 'subtitle'

    if not video_file:
        return JsonResponse({'success': False, 'error': 'No video file provided.'}, status=400)

    # Validate file extension
    ext = os.path.splitext(video_file.name)[1].lower()
    valid_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv']
    if ext not in valid_extensions:
        return JsonResponse({
            'success': False, 
            'error': f'Unsupported video format. Allowed formats: {", ".join(valid_extensions)}'
        }, status=400)

    # Base parameters setup
    video_path = ""
    video_clip = None

    try:
        if conversion_type == 'subtitle':
            # Subtitle options
            audio_format = None
            bitrate = None
            spoken_language = request.POST.get('language', 'en-US')
            sub_format = request.POST.get('sub_format', 'srt').lower()  # 'srt' or 'vtt'
            translation_target = request.POST.get('translation_target', 'none').lower()

            if sub_format not in ['srt', 'vtt']:
                return JsonResponse({'success': False, 'error': 'Unsupported subtitle format.'}, status=400)
            
            if not sr:
                return JsonResponse({
                    'success': False, 
                    'error': "SpeechRecognition package is not installed on the server. Please run: pip install SpeechRecognition"
                }, status=500)

            # Create DB entry with translation suffix in format "source➜target" if translation is enabled
            db_spoken_language = spoken_language
            is_translation_active = (translation_target != 'none' and translation_target != spoken_language.split('-')[0])
            if is_translation_active:
                db_spoken_language = f"{spoken_language}➜{translation_target}"

            conversion = Conversion.objects.create(
                original_filename=video_file.name,
                video_file=video_file,
                conversion_type='subtitle',
                spoken_language=db_spoken_language
            )

            video_path = conversion.video_file.path
            video_clip = VideoFileClip(video_path)

            if video_clip.audio is None:
                raise ValueError("The uploaded video has no audio track for subtitle generation.")

            duration_sec = video_clip.duration
            minutes = int(duration_sec // 60)
            seconds = int(duration_sec % 60)
            duration_str = f"{minutes:02d}:{seconds:02d}"

            # Create temp directory for audio chunks
            temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp_chunks')
            os.makedirs(temp_dir, exist_ok=True)

            # Extract full audio track to temporary WAV for quiet split point detection
            full_wav_filename = f"full_{conversion.id}.wav"
            full_wav_path = os.path.join(temp_dir, full_wav_filename)
            
            try:
                video_clip.audio.write_audiofile(
                    full_wav_path,
                    fps=16000,
                    codec='pcm_s16le',
                    ffmpeg_params=["-ac", "1"],
                    verbose=False,
                    logger=None
                )
            except TypeError:
                try:
                    video_clip.audio.write_audiofile(
                        full_wav_path,
                        fps=16000,
                        codec='pcm_s16le',
                        ffmpeg_params=["-ac", "1"],
                        verbose=False
                    )
                except TypeError:
                    video_clip.audio.write_audiofile(
                        full_wav_path,
                        fps=16000,
                        codec='pcm_s16le',
                        ffmpeg_params=["-ac", "1"]
                    )

            recognizer = sr.Recognizer()
            subtitles_blocks = []
            chunk_length = 7.0  # 7 seconds chunk size to keep subtitle text concise (max 2 rows)
            start_time = 0.0
            block_idx = 1

            while start_time < duration_sec:
                target_end = start_time + chunk_length
                
                if target_end < duration_sec:
                    search_start = max(start_time + 2.0, target_end - 1.0)
                    search_end = min(duration_sec - 1.0, target_end + 1.0)
                    
                    if search_start < search_end and os.path.exists(full_wav_path):
                        end_time = find_quiet_split_point(full_wav_path, search_start, search_end)
                    else:
                        end_time = target_end
                else:
                    end_time = duration_sec

                end_time = round(end_time, 2)
                
                # Slices the audio
                if hasattr(video_clip.audio, 'subclipped'):
                    audio_subclip = video_clip.audio.subclipped(start_time, end_time)
                else:
                    audio_subclip = video_clip.audio.subclip(start_time, end_time)
                chunk_filename = f"chunk_{conversion.id}_{block_idx}.wav"
                chunk_path = os.path.join(temp_dir, chunk_filename)
                
                # Write mono 16kHz WAV chunk file optimized for speech recognition
                try:
                    audio_subclip.write_audiofile(
                        chunk_path,
                        fps=16000,
                        codec='pcm_s16le',
                        ffmpeg_params=["-ac", "1"],
                        verbose=False,
                        logger=None
                    )
                except TypeError:
                    try:
                        audio_subclip.write_audiofile(
                            chunk_path,
                            fps=16000,
                            codec='pcm_s16le',
                            ffmpeg_params=["-ac", "1"],
                            verbose=False
                        )
                    except TypeError:
                        audio_subclip.write_audiofile(
                            chunk_path,
                            fps=16000,
                            codec='pcm_s16le',
                            ffmpeg_params=["-ac", "1"]
                        )
                
                # Transcribe chunk
                text = transcribe_audio_chunk(recognizer, chunk_path, spoken_language)
                
                if text:
                    # Translate to target language if selected and different from spoken
                    if is_translation_active:
                        text = translate_text(text, source_lang=spoken_language, target_lang=translation_target)

                    subtitles_blocks.append({
                        'index': block_idx,
                        'start': start_time,
                        'end': end_time,
                        'text': text
                    })
                    block_idx += 1



                # Clean up temporary chunk file
                if os.path.exists(chunk_path):
                    try:
                        os.remove(chunk_path)
                    except OSError:
                        pass
                
                start_time = end_time

            # Clean up temporary full WAV file
            if os.path.exists(full_wav_path):
                try:
                    os.remove(full_wav_path)
                except OSError:
                    pass

            # Generate Subtitle file contents
            subtitle_content = ""
            if sub_format == 'srt':
                for block in subtitles_blocks:
                    start_str = format_srt_time(block['start'])
                    end_str = format_srt_time(block['end'])
                    subtitle_content += f"{block['index']}\n{start_str} --> {end_str}\n{block['text']}\n\n"
            else:  # WebVTT
                subtitle_content = "WEBVTT\n\n"
                for block in subtitles_blocks:
                    start_str = format_vtt_time(block['start'])
                    end_str = format_vtt_time(block['end'])
                    subtitle_content += f"{start_str} --> {end_str}\n{block['text']}\n\n"

            # Fallback if no subtitles detected
            if not subtitle_content.strip() or (sub_format == 'vtt' and len(subtitles_blocks) == 0):
                if sub_format == 'srt':
                    subtitle_content = "1\n00:00:00,000 --> 00:00:02,000\n[No spoken text recognized]\n"
                else:
                    subtitle_content = "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n[No spoken text recognized]\n"

            # Save Subtitle file
            base_name = os.path.splitext(conversion.original_filename)[0]
            clean_name = "".join(c for c in base_name if c.isalnum() or c in (' ', '_', '-')).strip()
            clean_name = clean_name.replace(' ', '_')
            if not clean_name:
                clean_name = "subtitles"
            
            sub_filename = f"{clean_name}_{conversion.id}.{sub_format}"
            subtitles_dir = os.path.join(settings.MEDIA_ROOT, 'subtitles')
            os.makedirs(subtitles_dir, exist_ok=True)
            subtitle_file_path = os.path.join(subtitles_dir, sub_filename)

            with open(subtitle_file_path, 'w', encoding='utf-8') as sf:
                sf.write(subtitle_content)

            # Also extract the full video audio track to MP3
            audio_filename = f"{clean_name}_{conversion.id}.mp3"
            audios_dir = os.path.join(settings.MEDIA_ROOT, 'audios')
            os.makedirs(audios_dir, exist_ok=True)
            audio_path = os.path.join(audios_dir, audio_filename)

            try:
                video_clip.audio.write_audiofile(
                    audio_path,
                    bitrate="192k",
                    codec="libmp3lame"
                )
            except TypeError:
                try:
                    video_clip.audio.write_audiofile(
                        audio_path,
                        bitrate="192k",
                        codec="libmp3lame",
                        verbose=False,
                        logger=None
                    )
                except TypeError:
                    video_clip.audio.write_audiofile(
                        audio_path,
                        bitrate="192k",
                        codec="libmp3lame",
                        verbose=False
                    )

            conversion.audio_file.name = f"audios/{audio_filename}"
            conversion.audio_format = 'mp3'
            conversion.audio_bitrate = '192k'
            conversion.subtitle_file.name = f"subtitles/{sub_filename}"
            conversion.duration = duration_str
            conversion.save()

            return JsonResponse({
                'success': True,
                'id': conversion.id,
                'conversion_type': 'subtitle',
                'original_filename': conversion.original_filename,
                'subtitle_url': conversion.subtitle_file.url,
                'subtitle_filename': sub_filename,
                'audio_url': conversion.audio_file.url,
                'audio_filename': audio_filename,
                'duration': duration_str,
                'spoken_language': conversion.spoken_language,
                'subtitle_text': subtitle_content,
                'video_url': conversion.video_file.url,
                'created_at': conversion.created_at.strftime('%Y-%m-%d %H:%M')
            })

        else:
            # Audio Extraction logic
            audio_format = request.POST.get('format', 'mp3').lower()
            bitrate = request.POST.get('bitrate', '192')  # 128, 192, 320

            if audio_format not in ['mp3', 'wav', 'aac', 'm4a']:
                return JsonResponse({'success': False, 'error': 'Unsupported target audio format.'}, status=400)

            # Create DB entry
            conversion = Conversion.objects.create(
                original_filename=video_file.name,
                video_file=video_file,
                conversion_type='audio',
                audio_format=audio_format,
                audio_bitrate=f"{bitrate}k"
            )

            video_path = conversion.video_file.path
            video_clip = VideoFileClip(video_path)

            if video_clip.audio is None:
                raise ValueError("The uploaded video has no audio track.")

            duration_sec = video_clip.duration
            minutes = int(duration_sec // 60)
            seconds = int(duration_sec % 60)
            duration_str = f"{minutes:02d}:{seconds:02d}"

            # Make output files
            base_name = os.path.splitext(conversion.original_filename)[0]
            clean_name = "".join(c for c in base_name if c.isalnum() or c in (' ', '_', '-')).strip()
            clean_name = clean_name.replace(' ', '_')
            if not clean_name:
                clean_name = "audio"
            audio_filename = f"{clean_name}_{conversion.id}.{audio_format}"

            audios_dir = os.path.join(settings.MEDIA_ROOT, 'audios')
            os.makedirs(audios_dir, exist_ok=True)
            audio_path = os.path.join(audios_dir, audio_filename)

            codecs = {
                'mp3': 'libmp3lame',
                'wav': 'pcm_s16le',
                'aac': 'aac',
                'm4a': 'aac'
            }
            codec = codecs.get(audio_format, 'libmp3lame')

            # Write audio track
            try:
                video_clip.audio.write_audiofile(
                    audio_path,
                    bitrate=f"{bitrate}k",
                    codec=codec
                )
            except TypeError:
                try:
                    video_clip.audio.write_audiofile(
                        audio_path,
                        bitrate=f"{bitrate}k",
                        codec=codec,
                        verbose=False,
                        logger=None
                    )
                except TypeError:
                    video_clip.audio.write_audiofile(
                        audio_path,
                        bitrate=f"{bitrate}k",
                        codec=codec,
                        verbose=False
                    )

            conversion.audio_file.name = f"audios/{audio_filename}"
            conversion.duration = duration_str
            conversion.save()

            return JsonResponse({
                'success': True,
                'id': conversion.id,
                'conversion_type': 'audio',
                'original_filename': conversion.original_filename,
                'audio_url': conversion.audio_file.url,
                'audio_filename': audio_filename,
                'duration': duration_str,
                'format': audio_format.upper(),
                'bitrate': f"{bitrate}kbps",
                'created_at': conversion.created_at.strftime('%Y-%m-%d %H:%M')
            })

    except Exception as e:
        # Cleanup DB entry since conversion failed
        if 'conversion' in locals():
            conversion.delete()
        return JsonResponse({
            'success': False,
            'error': f"Conversion failed: {str(e)}"
        }, status=500)

    finally:
        # Close clip properly to release system file handles
        if video_clip:
            try:
                video_clip.close()
            except Exception:
                pass
        if 'full_wav_path' in locals() and os.path.exists(full_wav_path):
            try:
                os.remove(full_wav_path)
            except OSError:
                pass

def conversion_history(request):
    """Retrieves list of successful conversions."""
    conversions = Conversion.objects.all()[:20]
    data = []
    for conv in conversions:
        # Verification depending on type
        if conv.conversion_type == 'subtitle':
            if conv.subtitle_file and os.path.exists(conv.subtitle_file.path):
                # Load subtitle preview text
                subtitle_preview = ""
                try:
                    with open(conv.subtitle_file.path, 'r', encoding='utf-8') as f:
                        subtitle_preview = f.read()
                except Exception:
                    pass

                data.append({
                    'id': conv.id,
                    'conversion_type': 'subtitle',
                    'original_filename': conv.original_filename,
                    'subtitle_url': conv.subtitle_file.url,
                    'subtitle_filename': conv.subtitle_filename,
                    'audio_url': conv.audio_file.url if conv.audio_file else "",
                    'audio_filename': conv.audio_filename if conv.audio_file else "",
                    'duration': conv.duration,
                    'spoken_language': conv.spoken_language,
                    'subtitle_text': subtitle_preview,
                    'video_url': conv.video_file.url,
                    'created_at': conv.created_at.strftime('%Y-%m-%d %H:%M')
                })
        else:
            if conv.audio_file and os.path.exists(conv.audio_file.path):
                data.append({
                    'id': conv.id,
                    'conversion_type': 'audio',
                    'original_filename': conv.original_filename,
                    'audio_url': conv.audio_file.url,
                    'audio_filename': conv.audio_filename,
                    'duration': conv.duration,
                    'format': conv.audio_format.upper() if conv.audio_format else "MP3",
                    'bitrate': conv.audio_bitrate if conv.audio_bitrate else "192k",
                    'created_at': conv.created_at.strftime('%Y-%m-%d %H:%M')
                })
    return JsonResponse({'conversions': data})

@require_POST
def delete_conversion(request, pk):
    """Deletes a conversion record and its associated files."""
    conversion = get_object_or_404(Conversion, pk=pk)
    
    # Delete local physical files
    if conversion.video_file and os.path.exists(conversion.video_file.path):
        try:
            os.remove(conversion.video_file.path)
        except OSError:
            pass
            
    if conversion.audio_file and os.path.exists(conversion.audio_file.path):
        try:
            os.remove(conversion.audio_file.path)
        except OSError:
            pass

    if conversion.subtitle_file and os.path.exists(conversion.subtitle_file.path):
        try:
            os.remove(conversion.subtitle_file.path)
        except OSError:
            pass
            
    conversion.delete()
    return JsonResponse({'success': True})
