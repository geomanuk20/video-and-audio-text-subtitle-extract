# Generated manually.

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Conversion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('original_filename', models.CharField(max_length=255)),
                ('video_file', models.FileField(upload_to='videos/')),
                ('audio_file', models.FileField(upload_to='audios/', null=True, blank=True)),
                ('audio_format', models.CharField(max_length=10)),
                ('audio_bitrate', models.CharField(max_length=10)),
                ('duration', models.CharField(default='00:00', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
