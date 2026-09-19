import os
from django.db import models

class Conversion(models.Model):
    original_filename = models.CharField(max_length=255)
    video_file = models.FileField(upload_to='videos/')
    conversion_type = models.CharField(max_length=20, default='audio')  # 'audio' or 'subtitle'
    audio_file = models.FileField(upload_to='audios/', null=True, blank=True)
    audio_format = models.CharField(max_length=10, blank=True, null=True)  # e.g., 'mp3', 'wav', 'aac', 'm4a'
    audio_bitrate = models.CharField(max_length=10, blank=True, null=True) # e.g., '128k', '192k', '320k'
    subtitle_file = models.FileField(upload_to='subtitles/', null=True, blank=True)
    spoken_language = models.CharField(max_length=20, default='en-US')
    duration = models.CharField(max_length=20, default='00:00')  # mm:ss format
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.original_filename} ({self.conversion_type})"
    
    @property
    def video_filename(self):
        return os.path.basename(self.video_file.name)

    @property
    def audio_filename(self):
        return os.path.basename(self.audio_file.name) if self.audio_file else ""

    @property
    def subtitle_filename(self):
        return os.path.basename(self.subtitle_file.name) if self.subtitle_file else ""
