let audioContext;
let currentTrackIndex = 0;
let tracks = [];
let currentSource = null;
let gainNode = null;
let isPlaying = false;
let currentTrackDuration = 0;
let playbackStartTime = 0;
let animationFrameId = null;
let currentPlaybackPosition = 0;
let initialInteractionHandled = false;
let currentVolume = 0.8;

let playPauseBtn;
let nextBtn;
let prevBtn;
let trackTitleElement;
let progressBarContainer;
let progressBarFill;
let currentTimeElement;
let totalTimeElement;
let audioPlayerContainer;
let audioSymbol;
let audioContent;
let volumeSlider;
let volumeIcon;

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
}

function setPlayIcon(playing) {
  if (!playPauseBtn) return;
  playPauseBtn.innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}"></i>`;
  playPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  refreshIcons();
}

async function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioContext.createGain();
    gainNode.gain.value = currentVolume;
    gainNode.connect(audioContext.destination);
  }
}

function updateVolumeIcon() {
  if (!volumeIcon) return;
  let icon = 'volume-2';
  if (currentVolume <= 0) icon = 'volume-x';
  else if (currentVolume < 0.45) icon = 'volume-1';
  volumeIcon.setAttribute('data-lucide', icon);
  refreshIcons();
}

function setVolume(value) {
  currentVolume = Math.min(1, Math.max(0, value));
  if (gainNode) gainNode.gain.value = currentVolume;
  if (volumeSlider) volumeSlider.value = Math.round(currentVolume * 100);
  updateVolumeIcon();
}

async function loadAudioList() {
  try {
    const response = await fetch('/audio_list.json');
    tracks = await response.json();
    if (tracks.length > 0) {
      // no fucking idea what this means but i put it here cause i thought it was funny
      currentTrackIndex = Math.floor(Math.random() * tracks.length);
     
      updateTrackTitle("Click to Play");
      updateTimeDisplay(0, 0);
      
      if (playPauseBtn) playPauseBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
      if (prevBtn) prevBtn.disabled = false;
    } else {
      updateTrackTitle("No tracks available");
      updateTimeDisplay(0, 0); 
      if (playPauseBtn) playPauseBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (prevBtn) prevBtn.disabled = true;
    }
  } catch (error) {
    console.error('Failed to load audio list:', error);
    updateTrackTitle("Error loading tracks");
    updateTimeDisplay(0, 0); 
    if (playPauseBtn) playPauseBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (prevBtn) prevBtn.disabled = true;
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const formattedSeconds = remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds;
  return `${minutes}:${formattedSeconds}`;
}

function updateTimeDisplay(currentTime, totalDuration) {
  if (currentTimeElement) currentTimeElement.textContent = formatTime(currentTime);
  if (totalTimeElement) totalTimeElement.textContent = formatTime(totalDuration);
}

function updateProgressBar() {
  if (!isPlaying || !audioContext || audioContext.state === 'suspended' || currentTrackDuration === 0) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    return;
  }

  const elapsed = audioContext.currentTime - playbackStartTime;
  currentPlaybackPosition = elapsed; 

  const progress = Math.min(1, elapsed / currentTrackDuration);

  if (progressBarFill) progressBarFill.style.width = `${progress * 100}%`;
  if (progressBarContainer) progressBarContainer.setAttribute('aria-valuenow', Math.round(progress * 100));
  updateTimeDisplay(elapsed, currentTrackDuration); 

  if (progress < 1) {
    animationFrameId = requestAnimationFrame(updateProgressBar);
  } else {
    // Track finished playing naturally
    if (progressBarFill) progressBarFill.style.width = '100%';
    updateTimeDisplay(currentTrackDuration, currentTrackDuration);
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    isPlaying = false;
    setPlayIcon(false);
    if (progressBarFill) progressBarFill.style.width = '0%'; 
    currentTrackDuration = 0;
    playbackStartTime = 0;
    currentPlaybackPosition = 0;
    
    nextTrack();
  }
}

async function playTrack(index, startTime = 0) {
  if (tracks.length === 0) return;

  await initializeAudioContext(); 

  
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch (e) {
      isPlaying = false;
      setPlayIcon(false);
      updateTrackTitle("Click to Play");
      return;
    }
  }

 
  initialInteractionHandled = true;
  const track = tracks[index];
  updateTrackTitle(track.title);

  if (currentSource) {
    currentSource.onended = null;
    currentSource.stop();
    currentSource.disconnect();
    currentSource = null;
  }

  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  try {
    const response = await fetch(track.url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    currentTrackDuration = audioBuffer.duration;
    playbackStartTime = audioContext.currentTime - startTime; 
    currentPlaybackPosition = startTime;

    currentSource = audioContext.createBufferSource();
    currentSource.buffer = audioBuffer;
    currentSource.connect(gainNode);
    currentSource.start(0, startTime);

    isPlaying = true;
    setPlayIcon(true);

   
    updateProgressBar();

    currentSource.onended = () => {
     
      if (currentSource) { 
          currentSource.disconnect();
          currentSource = null; 
      }
    };

  } catch (error) {
    console.error('Error playing track:', track.url, error);
    isPlaying = false;
    setPlayIcon(false);
    updateTrackTitle("Error: " + track.title);
    if (progressBarFill) progressBarFill.style.width = '0%'; 
    currentTrackDuration = 0;
    playbackStartTime = 0;
    currentPlaybackPosition = 0;
    updateTimeDisplay(0,0);
  }
}

function togglePlayPause() {
  if (tracks.length === 0) return;

  if (!initialInteractionHandled) {
    
    handleFirstInteraction();
    return;
  }

  if (isPlaying) {
    if (currentSource) {
      currentSource.onended = null; 
      currentSource.stop(); 
      currentSource.disconnect();
      currentSource = null;
    }
    isPlaying = false;
    setPlayIcon(false);
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
   
  } else {
    
    playTrack(currentTrackIndex, currentPlaybackPosition);
  }
}

function nextTrack() {
  if (tracks.length === 0) return;
  currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
  playTrack(currentTrackIndex);
}

function prevTrack() {
  if (tracks.length === 0) return;
  currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
  playTrack(currentTrackIndex);
}

function updateTrackTitle(title) {
  if (trackTitleElement) { 
    trackTitleElement.textContent = title;
  }
}

function seekToClientX(clientX) {
  if (!progressBarContainer || currentTrackDuration <= 0) return;
  const bounds = progressBarContainer.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
  currentPlaybackPosition = ratio * currentTrackDuration;
  progressBarFill.style.width = `${ratio * 100}%`;
  progressBarContainer.setAttribute('aria-valuenow', Math.round(ratio * 100));
  updateTimeDisplay(currentPlaybackPosition, currentTrackDuration);
  if (isPlaying) playTrack(currentTrackIndex, currentPlaybackPosition);
}


async function handleFirstInteraction() {
  if (initialInteractionHandled) return; 

  // console.log("First user interaction detected.");

  await initializeAudioContext(); 

  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch (e) {
      console.error("Failed to resume AudioContext on first interaction:", e);
     
      return;
    }
  }

  
  if (tracks.length > 0) {
    playTrack(currentTrackIndex);
  } else {
    console.warn("No tracks loaded after first interaction.");
  }

  
  initialInteractionHandled = true;

  
  document.removeEventListener('click', handleFirstInteraction);
  document.removeEventListener('keydown', handleFirstInteraction);
}

window.addEventListener('load', async () => {
  
  playPauseBtn = document.getElementById('play-pause-btn');
  nextBtn = document.getElementById('next-btn');
  prevBtn = document.getElementById('prev-btn');
  trackTitleElement = document.getElementById('track-title');
  progressBarContainer = document.getElementById('progress-bar-container');
  progressBarFill = document.getElementById('progress-bar-fill');
  currentTimeElement = document.getElementById('current-time');
  totalTimeElement = document.getElementById('total-time');
  audioPlayerContainer = document.getElementById('audio-player-container');
  audioSymbol = document.getElementById('audio-symbol');
  audioContent = document.getElementById('audio-content');
  volumeSlider = document.getElementById('volume-slider');
  volumeIcon = document.getElementById('volume-icon');

  
  await loadAudioList();

  
  setPlayIcon(false);
  setVolume(currentVolume);
  refreshIcons();
  isPlaying = false;

 
  if (audioPlayerContainer) {
    audioPlayerContainer.classList.add('expanded');
    setTimeout(() => {
      audioPlayerContainer.classList.remove('expanded');
    }, 2000);

    
    audioPlayerContainer.addEventListener('mouseenter', () => {
      audioPlayerContainer.classList.add('expanded');
    });

    audioPlayerContainer.addEventListener('mouseleave', () => {
      audioPlayerContainer.classList.remove('expanded');
    });

    audioSymbol.addEventListener('click', event => {
      event.stopPropagation();
      audioPlayerContainer.classList.toggle('expanded');
    });
  }

  
  if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
  if (nextBtn) nextBtn.addEventListener('click', nextTrack);
  if (prevBtn) prevBtn.addEventListener('click', prevTrack);
  if (volumeSlider) {
    volumeSlider.addEventListener('input', event => {
      setVolume(Number(event.target.value) / 100);
    });
  }
  if (progressBarContainer) {
    progressBarContainer.addEventListener('click', event => seekToClientX(event.clientX));
    progressBarContainer.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || currentTrackDuration <= 0) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      currentPlaybackPosition = Math.min(currentTrackDuration, Math.max(0, currentPlaybackPosition + direction * 5));
      const rect = progressBarContainer.getBoundingClientRect();
      seekToClientX(rect.left + (currentPlaybackPosition / currentTrackDuration) * rect.width);
    });
  }

  
  document.addEventListener('click', handleFirstInteraction, { once: true });
  document.addEventListener('keydown', handleFirstInteraction, { once: true });
});

