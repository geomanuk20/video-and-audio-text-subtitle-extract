# Generated manually.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('converter_app', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='conversion',
            name='conversion_type',
            field=models.CharField(default='audio', max_length=20),
        ),
        migrations.AddField(
            model_name='conversion',
            name='subtitle_file',
            field=models.FileField(blank=True, null=True, upload_to='subtitles/'),
        ),
        migrations.AddField(
            model_name='conversion',
            name='spoken_language',
            field=models.CharField(default='en-US', max_length=20),
        ),
        migrations.AlterField(
            model_name='conversion',
            name='audio_format',
            field=models.CharField(blank=True, null=True, max_length=10),
        ),
        migrations.AlterField(
            model_name='conversion',
            name='audio_bitrate',
            field=models.CharField(blank=True, null=True, max_length=10),
        ),
    ]
