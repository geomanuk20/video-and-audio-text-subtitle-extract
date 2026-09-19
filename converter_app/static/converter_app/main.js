document.addEventListener('DOMContentLoaded', () => {
    // Tab switching elements
    const tabAudioBtn = document.getElementById('tabAudioBtn');
    const tabSubtitleBtn = document.getElementById('tabSubtitleBtn');
    const conversionTypeInput = document.getElementById('conversionTypeInput');
    const audioSettingsGrid = document.getElementById('audioSettingsGrid');
    const subtitleSettingsGrid = document.getElementById('subtitleSettingsGrid');
    const convertBtnText = document.getElementById('convertBtnText');

    // DOM Elements
    const uploadForm = document.getElementById('uploadForm');
    const dropZone = document.getElementById('dropZone');
    const videoInput = document.getElementById('videoInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    
    const filePreview = document.getElementById('filePreview');
    const fileNameText = document.getElementById('fileNameText');
    const fileSizeText = document.getElementById('fileSizeText');
    const removeFileBtn = document.getElementById('removeFileBtn');
    
    const convertBtn = document.getElementById('convertBtn');
    
    const progressCard = document.getElementById('progressCard');
    const statusLabel = document.getElementById('statusLabel');
    const percentageLabel = document.getElementById('percentageLabel');
    const progressBarFill = document.getElementById('progressBarFill');
    const spinnerContainer = document.getElementById('spinnerContainer');
    const spinnerText = document.getElementById('spinnerText');
    
    const resultCard = document.getElementById('resultCard');
    
    // Result panels
    const audioResultWrapper = document.getElementById('audioResultWrapper');
    const resultFileName = document.getElementById('resultFileName');
    const resultDuration = document.getElementById('resultDuration');
    const resultFormat = document.getElementById('resultFormat');
    const resultBitrate = document.getElementById('resultBitrate');
    const resultAudioPlayer = document.getElementById('resultAudioPlayer');
    
    const subtitleResultWrapper = document.getElementById('subtitleResultWrapper');
    const resultSubFileName = document.getElementById('resultSubFileName');
    const resultSubDuration = document.getElementById('resultSubDuration');
    const resultSubFormat = document.getElementById('resultSubFormat');
    const resultSubLanguage = document.getElementById('resultSubLanguage');
    const subtitlePreviewText = document.getElementById('subtitlePreviewText');
    const copySubtitlesBtn = document.getElementById('copySubtitlesBtn');
    const resultVideoContainer = document.getElementById('resultVideoContainer');
    const resultVideoPlayer = document.getElementById('resultVideoPlayer');
    const subAudioPlayerContainer = document.getElementById('subAudioPlayerContainer');
    const resultSubAudioPlayer = document.getElementById('resultSubAudioPlayer');

    const downloadBtn = document.getElementById('downloadBtn');
    const downloadAudioBtn = document.getElementById('downloadAudioBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    // History logs
    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');
    const historyLoading = document.getElementById('historyLoading');
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

    // Modal elements
    const subtitleModal = document.getElementById('subtitleModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalCopyBtn = document.getElementById('modalCopyBtn');
    const modalFileTitle = document.getElementById('modalFileTitle');
    const modalSubtitlesText = document.getElementById('modalSubtitlesText');
    const modalVideoContainer = document.getElementById('modalVideoContainer');
    const modalVideoPlayer = document.getElementById('modalVideoPlayer');

    // Max file size: 5GB in bytes
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;
    const VALID_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];

    // In-memory cache for loaded subtitles to avoid repeating server hits
    const subtitleCache = {};
    const videoUrlCache = {};
    let currentActiveSubtitleText = '';
    let currentModalSubtitleText = '';

    // Initial load
    loadHistory();

    // Tab Switching Navigation listeners
    tabAudioBtn.addEventListener('click', () => {
        switchTab('audio');
    });

    tabSubtitleBtn.addEventListener('click', () => {
        switchTab('subtitle');
    });

    function switchTab(type) {
        if (type === 'audio') {
            tabAudioBtn.classList.add('active');
            tabSubtitleBtn.classList.remove('active');
            conversionTypeInput.value = 'audio';
            audioSettingsGrid.style.display = 'grid';
            subtitleSettingsGrid.style.display = 'none';
            convertBtnText.textContent = 'Convert to Audio';
        } else {
            tabSubtitleBtn.classList.add('active');
            tabAudioBtn.classList.remove('active');
            conversionTypeInput.value = 'subtitle';
            subtitleSettingsGrid.style.display = 'grid';
            audioSettingsGrid.style.display = 'none';
            convertBtnText.textContent = 'Generate Subtitles';
        }
    }

    // Event Listeners for Browse button
    selectFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        videoInput.click();
    });

    // Drag and Drop Event Listeners
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleSelectedFile(files[0]);
        }
    });

    videoInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    // File Preview Dismissal
    removeFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetFileInput();
    });

    // Submit Conversion Form
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!videoInput.files.length) return;
        
        startConversion(videoInput.files[0]);
    });

    // Reset interface to convert another file
    resetBtn.addEventListener('click', () => {
        resultCard.style.display = 'none';
        uploadForm.style.display = 'block';
        
        // Stop results video playback
        if (resultVideoPlayer) {
            resultVideoPlayer.pause();
            resultVideoPlayer.innerHTML = '';
            resultVideoPlayer.src = '';
        }
        if (resultVideoContainer) {
            resultVideoContainer.style.display = 'none';
        }

        // Stop sub audio playback
        if (resultSubAudioPlayer) {
            resultSubAudioPlayer.pause();
            resultSubAudioPlayer.src = '';
        }
        if (subAudioPlayerContainer) {
            subAudioPlayerContainer.style.display = 'none';
        }

        // Reset download buttons
        if (downloadAudioBtn) {
            downloadAudioBtn.style.display = 'none';
            downloadAudioBtn.href = '#';
        }
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.classList.remove('three-buttons');
        }

        resetFileInput();
    });

    // Manual History Refresh
    refreshHistoryBtn.addEventListener('click', () => {
        loadHistory();
    });

    // Copy Subtitles triggers
    copySubtitlesBtn.addEventListener('click', () => {
        copyToClipboard(currentActiveSubtitleText, copySubtitlesBtn);
    });

    modalCopyBtn.addEventListener('click', () => {
        copyToClipboard(currentModalSubtitleText, modalCopyBtn);
    });

    function closeSubtitleModal() {
        subtitleModal.style.display = 'none';
        if (modalVideoPlayer) {
            modalVideoPlayer.pause();
            if (modalVideoPlayer._subtitleCleanup) {
                modalVideoPlayer._subtitleCleanup();
            }
            modalVideoPlayer.innerHTML = '';
            modalVideoPlayer.src = '';
        }
        if (modalVideoContainer) {
            modalVideoContainer.style.display = 'none';
        }
    }

    // Close Modal overlay
    closeModalBtn.addEventListener('click', closeSubtitleModal);

    subtitleModal.addEventListener('click', (e) => {
        if (e.target === subtitleModal) {
            closeSubtitleModal();
        }
    });

    // Handle selected file details and validation
    function handleSelectedFile(file) {
        // Validate extension
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!VALID_EXTENSIONS.includes(ext)) {
            alert(`Unsupported file format. Please upload a video file (${VALID_EXTENSIONS.join(', ')}).`);
            resetFileInput();
            return;
        }

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
            alert(`File size exceeds 5GB. Please choose a smaller video file.`);
            resetFileInput();
            return;
        }

        // Show details in UI
        fileNameText.textContent = file.name;
        fileSizeText.textContent = formatBytes(file.size);
        
        // Hide standard prompt, display custom preview
        dropZone.querySelector('.drop-zone-content').style.display = 'none';
        filePreview.style.display = 'flex';
        
        // Enable convert button
        convertBtn.disabled = false;
        
        // Add animations
        filePreview.style.animation = 'fadeIn 0.3s ease-out';
    }

    // Reset drop zone state
    function resetFileInput() {
        videoInput.value = '';
        dropZone.querySelector('.drop-zone-content').style.display = 'flex';
        filePreview.style.display = 'none';
        convertBtn.disabled = true;
    }

    // Main API Upload & Process execution
    function startConversion(file) {
        const type = conversionTypeInput.value;

        // Hide input panel, display progress card
        uploadForm.style.display = 'none';
        progressCard.style.display = 'flex';
        progressCard.style.animation = 'fadeIn 0.3s ease-out';
        
        statusLabel.textContent = 'Uploading video file...';
        percentageLabel.textContent = '0%';
        progressBarFill.style.width = '0%';
        spinnerContainer.style.display = 'none';
        
        if (type === 'subtitle') {
            spinnerText.textContent = 'Transcribing speech track. This may take a moment...';
        } else {
            spinnerText.textContent = 'Extracting audio layers. Please wait...';
        }

        const formData = new FormData(uploadForm);
        const xhr = new XMLHttpRequest();
        
        // Setup Progress tracking
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressBarFill.style.width = `${percentComplete}%`;
                percentageLabel.textContent = `${percentComplete}%`;
                
                if (percentComplete === 100) {
                    statusLabel.textContent = 'Processing files...';
                    spinnerContainer.style.display = 'flex';
                }
            }
        });

        // Request callback completion handler
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        renderConversionResult(response);
                    } else {
                        handleFailure(response.error || 'Conversion encountered an error.');
                    }
                } catch (e) {
                    handleFailure('Server returned invalid response.');
                }
            } else {
                try {
                    const response = JSON.parse(xhr.responseText);
                    handleFailure(response.error || 'Upload failed due to connection error.');
                } catch (e) {
                    handleFailure(`Server returned code ${xhr.status}`);
                }
            }
        };

        xhr.onerror = function() {
            handleFailure('Connection error occurred.');
        };

        xhr.open('POST', '/convert/', true);
        
        // Fetch CSRF token from DOM and set request header
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        xhr.setRequestHeader('X-CSRFToken', csrfToken);
        
        // Send payload
        xhr.send(formData);
    }

    // Render result card upon completion
    function renderConversionResult(data) {
        progressCard.style.display = 'none';
        resultCard.style.display = 'flex';
        
        if (data.conversion_type === 'subtitle') {
            audioResultWrapper.style.display = 'none';
            subtitleResultWrapper.style.display = 'block';

            resultSubFileName.textContent = data.subtitle_filename;
            resultSubDuration.textContent = data.duration;
            resultSubFormat.textContent = data.subtitle_filename.split('.').pop().toUpperCase();
            
            resultSubLanguage.textContent = resolveLangName(data.spoken_language);
            
            // Populate preview box
            // Cache subtitle and video details locally
            subtitleCache[data.id] = data.subtitle_text;
            videoUrlCache[data.id] = data.video_url;
            currentActiveSubtitleText = data.subtitle_text;

            // Load and display Video Preview with tracks and interactive text
            if (resultVideoContainer && resultVideoPlayer) {
                resultVideoContainer.style.display = 'block';
                loadVideoSubtitles(resultVideoPlayer, data.video_url, data.subtitle_text, false);
                renderInteractiveSubtitles(subtitlePreviewText, data.subtitle_text, resultVideoPlayer);
            } else {
                subtitlePreviewText.textContent = data.subtitle_text;
            }

            // Load and play subtitle concurrent MP3 audio
            if (resultSubAudioPlayer && subAudioPlayerContainer) {
                resultSubAudioPlayer.src = data.audio_url;
                resultSubAudioPlayer.load();
                subAudioPlayerContainer.style.display = 'block';
            }

            downloadBtn.href = data.subtitle_url;
            downloadBtn.setAttribute('download', data.subtitle_filename);
            downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download Subtitles';

            // Show secondary download button for audio
            if (downloadAudioBtn) {
                downloadAudioBtn.href = data.audio_url;
                downloadAudioBtn.setAttribute('download', data.audio_filename);
                downloadAudioBtn.style.display = 'inline-flex';
            }

            const actionButtons = document.querySelector('.action-buttons');
            if (actionButtons) {
                actionButtons.classList.add('three-buttons');
            }
        } else {
            subtitleResultWrapper.style.display = 'none';
            audioResultWrapper.style.display = 'block';

            resultFileName.textContent = data.audio_filename;
            resultDuration.textContent = data.duration;
            resultFormat.textContent = data.format;
            resultBitrate.textContent = data.bitrate;
            
            resultAudioPlayer.src = data.audio_url;
            resultAudioPlayer.load();

            // Hide subtitle specific elements
            if (resultSubAudioPlayer) {
                resultSubAudioPlayer.pause();
                resultSubAudioPlayer.src = '';
            }
            if (subAudioPlayerContainer) {
                subAudioPlayerContainer.style.display = 'none';
            }
            if (downloadAudioBtn) {
                downloadAudioBtn.style.display = 'none';
                downloadAudioBtn.href = '#';
            }

            const actionButtons = document.querySelector('.action-buttons');
            if (actionButtons) {
                actionButtons.classList.remove('three-buttons');
            }

            downloadBtn.href = data.audio_url;
            downloadBtn.setAttribute('download', data.audio_filename);
            downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download File';
        }
        
        // Refresh the conversion list
        loadHistory();
    }

    // Reset UI upon operational failure
    function handleFailure(message) {
        alert(`Error: ${message}`);
        progressCard.style.display = 'none';
        uploadForm.style.display = 'block';
    }

    // Fetch and render conversion log history list
    function loadHistory() {
        historyLoading.style.display = 'flex';
        historyEmpty.style.display = 'none';
        historyList.style.display = 'none';

        fetch('/history/')
            .then(res => res.json())
            .then(data => {
                historyLoading.style.display = 'none';
                
                if (!data.conversions || data.conversions.length === 0) {
                    historyEmpty.style.display = 'flex';
                    return;
                }

                historyList.innerHTML = '';
                data.conversions.forEach(item => {
                    const card = createHistoryItemCard(item);
                    historyList.appendChild(card);
                });

                historyList.style.display = 'flex';
            })
            .catch(() => {
                historyLoading.style.display = 'none';
                historyEmpty.style.display = 'flex';
                historyEmpty.querySelector('p').textContent = 'Could not load conversion log history.';
            });
    }

    // Dynamic creator for conversion list elements
    function createHistoryItemCard(item) {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.id = `history-item-${item.id}`;
        
        const isSubtitle = (item.conversion_type === 'subtitle');
        
        if (isSubtitle) {
            // Cache subtitle text and video URL from logs
            subtitleCache[item.id] = item.subtitle_text;
            videoUrlCache[item.id] = item.video_url;
            
            const visualLang = resolveLangName(item.spoken_language);
            
            let audioPlayerHTML = '';
            let downloadAudioHTML = '';
            if (item.audio_url) {
                downloadAudioHTML = `
                    <a href="${item.audio_url}" class="mini-action-btn" download="${item.audio_filename}" title="Download MP3 Audio">
                        <i class="fa-solid fa-file-audio"></i>
                    </a>
                `;
                audioPlayerHTML = `
                    <div class="history-player" style="margin-top: 0.5rem;">
                        <audio controls class="history-audio-element">
                            <source src="${item.audio_url}" type="audio/mpeg">
                        </audio>
                    </div>
                `;
            }

            div.innerHTML = `
                <div class="item-main-row">
                    <div class="item-info">
                        <h4 class="item-title" title="${item.original_filename}">${item.original_filename}</h4>
                        <div class="item-meta">
                            <span class="detail-badge"><i class="fa-regular fa-clock"></i> ${item.duration}</span>
                            <span class="detail-badge"><i class="fa-solid fa-closed-captioning"></i> ${item.subtitle_filename.split('.').pop().toUpperCase()}</span>
                            <span class="detail-badge"><i class="fa-solid fa-language"></i> ${visualLang}</span>
                            <span class="item-time">${item.created_at}</span>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="mini-action-btn view-subtitle-btn" data-id="${item.id}" title="Preview Subtitles">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                        <a href="${item.subtitle_url}" class="mini-action-btn download-action-btn" download="${item.subtitle_filename}" title="Download Subtitles">
                            <i class="fa-solid fa-download"></i>
                        </a>
                        ${downloadAudioHTML}
                        <button class="mini-action-btn delete-action-btn" data-id="${item.id}" title="Delete">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                ${audioPlayerHTML}
            `;
            
            // Bind view modal click
            const viewBtn = div.querySelector('.view-subtitle-btn');
            viewBtn.addEventListener('click', () => {
                showSubtitleModal(item.subtitle_filename, item.id);
            });

        } else {
            div.innerHTML = `
                <div class="item-main-row">
                    <div class="item-info">
                        <h4 class="item-title" title="${item.original_filename}">${item.original_filename}</h4>
                        <div class="item-meta">
                            <span class="detail-badge"><i class="fa-regular fa-clock"></i> ${item.duration}</span>
                            <span class="detail-badge"><i class="fa-solid fa-music"></i> ${item.format}</span>
                            <span class="detail-badge"><i class="fa-solid fa-gauge-high"></i> ${item.bitrate}</span>
                            <span class="item-time">${item.created_at}</span>
                        </div>
                    </div>
                    <div class="item-actions">
                        <a href="${item.audio_url}" class="mini-action-btn download-action-btn" download="${item.audio_filename}" title="Download">
                            <i class="fa-solid fa-download"></i>
                        </a>
                        <button class="mini-action-btn delete-action-btn" data-id="${item.id}" title="Delete">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                <div class="history-player">
                    <audio controls class="history-audio-element">
                        <source src="${item.audio_url}" type="audio/${item.format.toLowerCase() === 'm4a' ? 'mp4' : item.format.toLowerCase()}">
                    </audio>
                </div>
            `;
        }

        // Bind delete functionality
        const deleteBtn = div.querySelector('.delete-action-btn');
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this conversion record? The associated files will also be removed.')) {
                deleteConversion(item.id);
            }
        });

        return div;
    }

    // Helper: Convert SRT format to WebVTT format on-the-fly
    function srtToVtt(srtText) {
        if (srtText.trim().startsWith('WEBVTT')) {
            return srtText;
        }
        // Replace commas with dots in timestamps
        let vttText = srtText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        return 'WEBVTT\n\n' + vttText;
    }

    let resultTrackUrl = null;
    let modalTrackUrl = null;

    // Helper: Loads video source and hooks subtitles as a Blob track
    function loadVideoSubtitles(videoPlayer, videoUrl, subtitleText, isModal = false) {
        // Clean up previous blob URL
        if (isModal) {
            if (modalTrackUrl) {
                URL.revokeObjectURL(modalTrackUrl);
                modalTrackUrl = null;
            }
        } else {
            if (resultTrackUrl) {
                URL.revokeObjectURL(resultTrackUrl);
                resultTrackUrl = null;
            }
        }

        // Pause player and clear inner HTML elements
        videoPlayer.pause();
        videoPlayer.innerHTML = '';
        
        // Disable any leftover tracks programmatically to prevent browser cache overlap
        if (videoPlayer.textTracks) {
            for (let i = 0; i < videoPlayer.textTracks.length; i++) {
                videoPlayer.textTracks[i].mode = 'disabled';
            }
        }

        const source = document.createElement('source');
        source.src = videoUrl;
        source.type = 'video/mp4';
        videoPlayer.appendChild(source);
        
        try {
            const vttContent = srtToVtt(subtitleText);
            const blob = new Blob([vttContent], { type: 'text/vtt' });
            const blobUrl = URL.createObjectURL(blob);
            
            if (isModal) {
                modalTrackUrl = blobUrl;
            } else {
                resultTrackUrl = blobUrl;
            }
            
            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = 'Generated Subtitles';
            track.srclang = 'en';
            track.src = blobUrl;
            track.default = true;
            
            videoPlayer.appendChild(track);
        } catch (e) {
            console.error("Failed to bind subtitle track: ", e);
        }
        
        videoPlayer.load();
    }

    // Helper: HTML string escaper to prevent XSS in rendering
    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Helper: Parse SRT or WebVTT into structured segments array
    function parseSubtitles(subText) {
        const lines = subText.split(/\r?\n/);
        const blocks = [];
        let currentBlock = null;
        
        function timeToSeconds(timeStr) {
            const parts = timeStr.replace(',', '.').split(':');
            let secs = 0;
            if (parts.length === 3) {
                secs += parseFloat(parts[0]) * 3600;
                secs += parseFloat(parts[1]) * 60;
                secs += parseFloat(parts[2]);
            } else if (parts.length === 2) {
                secs += parseFloat(parts[0]) * 60;
                secs += parseFloat(parts[1]);
            }
            return secs;
        }

        const timestampRegex = /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const match = line.match(timestampRegex);
            if (match) {
                if (currentBlock) {
                    blocks.push(currentBlock);
                }
                currentBlock = {
                    start: timeToSeconds(match[1]),
                    end: timeToSeconds(match[2]),
                    startStr: match[1],
                    endStr: match[2],
                    text: []
                };
            } else if (currentBlock) {
                if (line === String(blocks.length + 1) && currentBlock.text.length === 0) {
                    continue;
                }
                if (line.toLowerCase() !== 'webvtt') {
                    currentBlock.text.push(line);
                }
            }
        }
        if (currentBlock) {
            blocks.push(currentBlock);
        }
        
        return blocks.map(b => ({
            start: b.start,
            end: b.end,
            timeStr: `${b.startStr} --> ${b.endStr}`,
            text: b.text.join('\n')
        }));
    }

    // Helper: Renders clickable interactive subtitle cards, highlights and auto-scrolls on timeupdate
    function renderInteractiveSubtitles(container, subtitleText, videoPlayer) {
        container.innerHTML = '';
        const segments = parseSubtitles(subtitleText);
        
        if (segments.length === 0) {
            container.textContent = subtitleText;
            return;
        }

        const segmentElements = [];
        
        segments.forEach(seg => {
            const div = document.createElement('div');
            div.className = 'subtitle-segment';
            div.dataset.start = seg.start;
            div.dataset.end = seg.end;
            
            div.innerHTML = `
                <span class="segment-time"><i class="fa-regular fa-clock"></i> ${seg.timeStr}</span>
                <p class="segment-text">${escapeHtml(seg.text)}</p>
            `;
            
            div.addEventListener('click', () => {
                videoPlayer.currentTime = seg.start;
                videoPlayer.play();
            });
            
            container.appendChild(div);
            segmentElements.push({
                start: seg.start,
                end: seg.end,
                element: div
            });
        });
        
        const onTimeUpdate = () => {
            const currentTime = videoPlayer.currentTime;
            let activeElement = null;
            
            segmentElements.forEach(segEl => {
                if (currentTime >= segEl.start && currentTime <= segEl.end) {
                    segEl.element.classList.add('active-segment');
                    activeElement = segEl.element;
                } else {
                    segEl.element.classList.remove('active-segment');
                }
            });
            
            if (activeElement) {
                const containerRect = container.getBoundingClientRect();
                const elemRect = activeElement.getBoundingClientRect();
                
                if (elemRect.top < containerRect.top || elemRect.bottom > containerRect.bottom) {
                    activeElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest'
                    });
                }
            }
        };

        videoPlayer.addEventListener('timeupdate', onTimeUpdate);
        
        if (videoPlayer._subtitleCleanup) {
            videoPlayer._subtitleCleanup();
        }
        videoPlayer._subtitleCleanup = () => {
            videoPlayer.removeEventListener('timeupdate', onTimeUpdate);
        };
    }

    // Modal popup triggers
    function showSubtitleModal(filename, id) {
        modalFileTitle.textContent = filename;
        const videoUrl = videoUrlCache[id];
        const subtitleText = subtitleCache[id] || "[No subtitle data found]";
        
        currentModalSubtitleText = subtitleText;

        if (videoUrl && modalVideoContainer && modalVideoPlayer) {
            modalVideoContainer.style.display = 'block';
            loadVideoSubtitles(modalVideoPlayer, videoUrl, subtitleText, true);
            renderInteractiveSubtitles(modalSubtitlesText, subtitleText, modalVideoPlayer);
        } else {
            if (modalVideoContainer) {
                modalVideoContainer.style.display = 'none';
            }
            modalSubtitlesText.textContent = subtitleText;
        }
        
        subtitleModal.style.display = 'flex';
        subtitleModal.style.animation = 'fadeIn 0.25s ease-out';
    }

    // Helper: clipboard copy triggers
    function copyToClipboard(text, buttonElement) {
        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
            buttonElement.style.background = 'rgba(16, 185, 129, 0.15)';
            buttonElement.style.borderColor = '#10b981';
            
            setTimeout(() => {
                buttonElement.innerHTML = originalHTML;
                buttonElement.style.background = '';
                buttonElement.style.borderColor = '';
            }, 1800);
        }).catch(() => {
            alert('Failed to copy to clipboard.');
        });
    }

    // Perform API call to delete a record
    function deleteConversion(id) {
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        
        fetch(`/delete/${id}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const element = document.getElementById(`history-item-${id}`);
                if (element) {
                    element.style.animation = 'fadeIn 0.3s reverse ease-out';
                    setTimeout(() => {
                        element.remove();
                        // If all items are deleted, check history length again
                        if (historyList.children.length === 0) {
                            historyList.style.display = 'none';
                            historyEmpty.style.display = 'flex';
                        }
                    }, 280);
                }
            } else {
                alert('Could not delete record.');
            }
        })
        .catch(() => {
            alert('An error occurred while deleting.');
        });
    }

    // Helper: Resolves and translates display names for languages
    function resolveLangName(langCode) {
        const languagesMap = {
            'en-US': 'English', 'en-GB': 'English (UK)', 'es-ES': 'Spanish',
            'es-MX': 'Spanish (MX)', 'fr-FR': 'French', 'de-DE': 'German',
            'zh-CN': 'Chinese (S)', 'zh-TW': 'Chinese (T)',
            'ar-SA': 'Arabic', 'pt-BR': 'Portuguese', 'it-IT': 'Italian',
            'ja-JP': 'Japanese', 'ru-RU': 'Russian',
            'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil',
            'te-IN': 'Telugu', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
            'kn-IN': 'Kannada', 'ml-IN': 'Malayalam', 'pa-IN': 'Punjabi',
            'ur-IN': 'Urdu', 'or-IN': 'Odia', 'sa-IN': 'Sanskrit',
            // Target simple codes
            'en': 'English', 'hi': 'Hindi', 'ml': 'Malayalam', 'ta': 'Tamil',
            'te': 'Telugu', 'kn': 'Kannada', 'bn': 'Bengali', 'mr': 'Marathi',
            'gu': 'Gujarati', 'pa': 'Punjabi', 'ur': 'Urdu', 'es': 'Spanish',
            'fr': 'French', 'de': 'German', 'ar': 'Arabic', 'ja': 'Japanese',
            'ru': 'Russian'
        };
        
        let code = langCode;
        if (code.endsWith(' (to English)')) {
            code = code.replace(' (to English)', '➜en');
        }
        
        if (code.includes('➜')) {
            const parts = code.split('➜');
            const source = languagesMap[parts[0]] || parts[0];
            const target = languagesMap[parts[1]] || parts[1];
            return `${source} ➜ ${target}`;
        }
        return languagesMap[code] || code;
    }

    // Helper: Byte size formatter
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
});
