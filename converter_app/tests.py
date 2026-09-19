import os
from django.test import TestCase, Client
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch, MagicMock
from .models import Conversion

class VideoToAudioConverterTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_dashboard_view(self):
        """Verify the index page renders with a 200 status."""
        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'converter_app/index.html')

    def test_history_api_empty_initial(self):
        """Verify the history endpoint starts empty and returns a valid JSON response."""
        response = self.client.get(reverse('conversion_history'))
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertIn('conversions', json_data)
        self.assertEqual(len(json_data['conversions']), 0)

    def test_convert_video_invalid_request(self):
        """Verify uploading without files returns 400."""
        response = self.client.post(reverse('convert_video'))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['success'])

    def test_convert_video_invalid_extension(self):
        """Verify files with unsupported extensions are rejected."""
        mock_file = SimpleUploadedFile("document.pdf", b"pdf_content_here", content_type="application/pdf")
        response = self.client.post(reverse('convert_video'), {'video': mock_file, 'format': 'mp3'})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['success'])
        self.assertIn("Unsupported video format", response.json()['error'])

    @patch('converter_app.views.VideoFileClip')
    def test_convert_video_audio_success_mocked(self, mock_video_clip):
        """Verify successful audio conversion and model recording with a mocked VideoFileClip."""
        # Setup mock instance of VideoFileClip
        mock_clip_instance = MagicMock()
        mock_clip_instance.duration = 45.5 # 45.5 seconds
        
        # Mocking the audio track
        mock_audio_instance = MagicMock()
        mock_clip_instance.audio = mock_audio_instance
        
        # Make the VideoFileClip call return this mock
        mock_video_clip.return_value = mock_clip_instance
        
        # Prepare dummy video file
        dummy_video = SimpleUploadedFile("sample_video.mp4", b"dummy_mp4_bytes", content_type="video/mp4")
        
        # Perform request
        response = self.client.post(reverse('convert_video'), {
            'video': dummy_video,
            'type': 'audio',
            'format': 'mp3',
            'bitrate': '192'
        })
        
        self.assertEqual(response.status_code, 200)
        json_resp = response.json()
        self.assertTrue(json_resp['success'])
        self.assertEqual(json_resp['duration'], '00:45')
        self.assertEqual(json_resp['conversion_type'], 'audio')
        
        # Verify database record exists
        conversion = Conversion.objects.get(pk=json_resp['id'])
        self.assertEqual(conversion.original_filename, 'sample_video.mp4')
        self.assertEqual(conversion.conversion_type, 'audio')
        
        # Cleanup created files if they were written
        if conversion.video_file and os.path.exists(conversion.video_file.path):
            os.remove(conversion.video_file.path)
        if conversion.audio_file and os.path.exists(conversion.audio_file.path):
            os.remove(conversion.audio_file.path)

    @patch('converter_app.views.sr')
    @patch('converter_app.views.transcribe_audio_chunk')
    @patch('converter_app.views.VideoFileClip')
    def test_convert_video_subtitle_success_mocked(self, mock_sr, mock_transcribe_chunk, mock_video_clip):
        """Verify successful subtitle generation with mocked audio tracks and speech recognizers."""
        # Setup mock instance of VideoFileClip
        mock_clip_instance = MagicMock()
        mock_clip_instance.duration = 35.0 # 35.0 seconds (triggers 3 segments of 15 seconds)
        
        # Mocking the audio track
        mock_audio_instance = MagicMock()
        mock_clip_instance.audio = mock_audio_instance
        mock_video_clip.return_value = mock_clip_instance

        # Mock speech recognizer module presence
        mock_sr.Recognizer.return_value = MagicMock()
        mock_sr.AudioFile.return_value = MagicMock()

        # Mock chunk transcription returning words
        mock_transcribe_chunk.side_effect = [
            "Hello world", 
            "SonicShift is great", 
            "Accuracy is improved",
            "Continuous speech segment",
            "Final transcription block",
            "Additional safety segment"
        ]
        
        # Prepare dummy video file
        dummy_video = SimpleUploadedFile("my_movie.mp4", b"dummy_mp4_bytes", content_type="video/mp4")
        
        # Perform request
        response = self.client.post(reverse('convert_video'), {
            'video': dummy_video,
            'type': 'subtitle',
            'language': 'en-US',
            'sub_format': 'srt'
        })
        
        self.assertEqual(response.status_code, 200)
        json_resp = response.json()
        self.assertTrue(json_resp['success'])
        self.assertEqual(json_resp['conversion_type'], 'subtitle')
        self.assertEqual(json_resp['duration'], '00:35')
        self.assertIn("Hello world", json_resp['subtitle_text'])
        self.assertIn("SonicShift is great", json_resp['subtitle_text'])
        
        # Verify database record exists
        conversion = Conversion.objects.get(pk=json_resp['id'])
        self.assertEqual(conversion.original_filename, 'my_movie.mp4')
        self.assertEqual(conversion.conversion_type, 'subtitle')
        
        # Cleanup created files if they were written
        if conversion.video_file and os.path.exists(conversion.video_file.path):
            os.remove(conversion.video_file.path)
        if conversion.subtitle_file and os.path.exists(conversion.subtitle_file.path):
            os.remove(conversion.subtitle_file.path)
