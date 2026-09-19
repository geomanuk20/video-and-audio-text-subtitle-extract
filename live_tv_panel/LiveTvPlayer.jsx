import React, { useState, useEffect, useRef } from 'react';
import './LiveTvPlayer.css';

// Pre-defined channels list (YouTube Live & M3U8 Streams)
const DEFAULT_CHANNELS = [
    {
        id: 'whiteswan-tv',
        name: 'Whiteswan TV News',
        category: 'News',
        streamUrl: 'https://www.youtube.com/watch?v=l51v4VjAcrM', // Replace with active stream URL if needed
        logo: '', // Fallback initials rendered if empty
        status: 'മുഖ്യമന്ത്രി VD സതീശൻ മന്ത്രിസഭാ യോഗത്തിന് ശേഷം മാധ്യമങ്ങളെ കാണുന്നു',
        courtesy: 'Whiteswan TV News Live'
    },
    {
        id: 'mediaone-live',
        name: 'MediaOne Live',
        category: 'News',
        streamUrl: 'https://www.youtube.com/watch?v=coD68p9wEgw',
        logo: '',
        status: 'Kerala News Live Updates | MediaOne TV',
        courtesy: 'MediaOne TV'
    },
    {
        id: 'reporter-tv',
        name: 'Reporter TV Live',
        category: 'News',
        streamUrl: 'https://www.youtube.com/watch?v=PyL-q69260Y',
        logo: '',
        status: 'Reporter TV Live Streaming | Malayalam News',
        courtesy: 'Reporter Live'
    },
    {
        id: 'hls-demo-1',
        name: 'Global Live Feed (HLS)',
        category: 'Entertainment',
        streamUrl: 'https://test-streams.mux.dev/x36xhg7/x36xhg7.m3u8', // Standard Mux Test stream
        logo: '',
        status: 'HD Streaming Feed (HLS M3U8 Demo)',
        courtesy: 'Mux Streams'
    },
    {
        id: 'hls-demo-2',
        name: 'Sintel TV Feed (HLS)',
        category: 'Movies',
        streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
        logo: '',
        status: 'Sintel Cine-stream HD Feed',
        courtesy: 'Akamai CDN'
    }
];

// Helper: Extract YouTube Video ID from any watch link or embed link
const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// Helper: Determine if the stream is an HLS (.m3u8) file
const isHlsStream = (url) => {
    return url && url.toLowerCase().includes('.m3u8');
};

const LiveTvPlayer = ({ onClose }) => {
    const [channels, setChannels] = useState(DEFAULT_CHANNELS);
    const [selectedChannel, setSelectedChannel] = useState(DEFAULT_CHANNELS[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [theaterMode, setTheaterMode] = useState(false);
    const [hlsError, setHlsError] = useState(false);
    
    const videoRef = useRef(null);
    const hlsInstanceRef = useRef(null);

    // Filter categories
    const categories = ['All', 'News', 'Movies', 'Entertainment'];

    // Filter channels based on category and search query
    const filteredChannels = channels.filter(channel => {
        const matchesCategory = selectedCategory === 'All' || channel.category === selectedCategory;
        const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              channel.status.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Handle HLS Player Setup (Hls.js)
    useEffect(() => {
        // Clear previous Hls instance
        if (hlsInstanceRef.current) {
            hlsInstanceRef.current.destroy();
            hlsInstanceRef.current = null;
        }
        setHlsError(false);

        const video = videoRef.current;
        if (!video || !isHlsStream(selectedChannel.streamUrl)) return;

        const initHls = async () => {
            // Load Hls.js from CDN dynamically if it is not already loaded
            if (!window.Hls) {
                const loaded = await new Promise((resolve) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
                    script.onload = () => resolve(true);
                    script.onerror = () => resolve(false);
                    document.head.appendChild(script);
                });
                if (!loaded) {
                    setHlsError(true);
                    return;
                }
            }

            if (window.Hls.isSupported()) {
                const hls = new window.Hls();
                hlsInstanceRef.current = hls;
                hls.loadSource(selectedChannel.streamUrl);
                hls.attachMedia(video);
                
                hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(err => {
                        console.log("Auto-play blocked, waiting for user action:", err);
                    });
                });

                hls.on(window.Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case window.Hls.ErrorTypes.NETWORK_ERROR:
                                console.error("HLS Network Error, trying to recover...");
                                hls.startLoad();
                                break;
                            case window.Hls.ErrorTypes.MEDIA_ERROR:
                                console.error("HLS Media Error, trying to recover...");
                                hls.recoverMediaError();
                                break;
                            default:
                                console.error("Fatal HLS Error, could not play");
                                setHlsError(true);
                                hls.destroy();
                                break;
                        }
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS support (Safari / iOS)
                video.src = selectedChannel.streamUrl;
                video.addEventListener('loadedmetadata', () => {
                    video.play().catch(err => {
                        console.log("Auto-play blocked:", err);
                    });
                });
            } else {
                setHlsError(true);
            }
        };

        initHls();

        return () => {
            if (hlsInstanceRef.current) {
                hlsInstanceRef.current.destroy();
                hlsInstanceRef.current = null;
            }
        };
    }, [selectedChannel]);

    const handleChannelSelect = (channel) => {
        setSelectedChannel(channel);
    };

    const toggleTheaterMode = () => {
        setTheaterMode(!theaterMode);
    };

    // Helper to render initials for fallback logo
    const getInitials = (name) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
    };

    const ytVideoId = getYoutubeId(selectedChannel.streamUrl);

    return (
        <div className={`live-tv-container ${theaterMode ? 'theater-mode' : ''}`}>
            
            {/* Left: Video Player Panel */}
            <div className="player-panel">
                
                {/* Header controls */}
                <div className="player-header">
                    <div className="channel-brand">
                        {selectedChannel.logo ? (
                            <img src={selectedChannel.logo} alt={selectedChannel.name} className="channel-brand-logo" />
                        ) : (
                            <div className="channel-brand-logo-fallback">
                                {getInitials(selectedChannel.name)}
                            </div>
                        )}
                        <div className="channel-brand-info">
                            <h2>{selectedChannel.name}</h2>
                            <p>{selectedChannel.courtesy}</p>
                        </div>
                    </div>
                    
                    <div className="player-top-actions">
                        <button 
                            className="btn-theater-toggle" 
                            onClick={toggleTheaterMode}
                            title={theaterMode ? "Normal mode" : "Theater mode"}
                        >
                            <i className={`fa-solid ${theaterMode ? 'fa-compress' : 'fa-expand'}`}></i>
                        </button>
                        
                        {onClose && (
                            <button className="btn-close-player" onClick={onClose} title="Close Player">
                                <i className="fa-solid fa-xmark"></i> CLOSE PLAYER
                            </button>
                        )}
                    </div>
                </div>

                {/* Video Stage wrapper */}
                <div className="video-canvas-wrapper">
                    {/* Live Badge Overlay */}
                    <div className="player-overlay-info">
                        <div className="overlay-meta-text">
                            <h3 className="overlay-meta-title">{selectedChannel.status}</h3>
                            <span className="overlay-meta-channel">{selectedChannel.name}</span>
                        </div>
                        <div className="live-badge">LIVE</div>
                    </div>

                    {/* Conditional Player type loading */}
                    {isHlsStream(selectedChannel.streamUrl) ? (
                        hlsError ? (
                            <div className="no-results" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '2.5rem', color: 'var(--live-red)' }}></i>
                                <p style={{ marginTop: '1rem' }}>Failed to load HLS live stream.</p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Make sure the link is active or try another channel.</p>
                            </div>
                        ) : (
                            <video 
                                ref={videoRef} 
                                controls 
                                playsInline 
                                width="100%" 
                                height="100%"
                                poster="https://via.placeholder.com/640x360/0b0f19/f8fafc?text=Connecting+to+Live+Feed..."
                            />
                        )
                    ) : ytVideoId ? (
                        <iframe
                            src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1&mute=0&rel=0&showinfo=0`}
                            title={selectedChannel.name}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />
                    ) : (
                        <div className="no-results" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}></i>
                            <p style={{ marginTop: '1rem' }}>Unsupported stream URL format.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Sidebar Channels Selection List */}
            <div className="channels-sidebar">
                
                {/* Search Bar */}
                <div className="sidebar-search-box">
                    <div className="search-input-wrapper">
                        <i className="fa-solid fa-magnifying-glass"></i>
                        <input 
                            type="text" 
                            placeholder="Search channel or news..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Category Filters */}
                <div className="category-filters">
                    {categories.map(category => (
                        <button
                            key={category}
                            className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* Scrollable Channels list */}
                <div className="channels-list">
                    {filteredChannels.length > 0 ? (
                        filteredChannels.map(channel => {
                            const isActive = selectedChannel.id === channel.id;
                            return (
                                <div 
                                    key={channel.id}
                                    className={`channel-card ${isActive ? 'active' : ''}`}
                                    onClick={() => handleChannelSelect(channel)}
                                >
                                    <div className="channel-card-logo-wrapper">
                                        {channel.logo ? (
                                            <img src={channel.logo} alt={channel.name} className="channel-card-logo" />
                                        ) : (
                                            <div className="channel-card-logo-fallback">
                                                {getInitials(channel.name)}
                                            </div>
                                        )}
                                        <span className="online-dot"></span>
                                    </div>
                                    
                                    <div className="channel-card-info">
                                        <div className="channel-card-name">{channel.name}</div>
                                        <div className="channel-card-status">{channel.status}</div>
                                    </div>

                                    <div className="channel-card-meta">
                                        <span className="channel-card-category">{channel.category}</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="no-results">
                            <i className="fa-solid fa-tv"></i>
                            <span>No channels match your filter</span>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default LiveTvPlayer;
