function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function createSnow() {
  const snowContainer = document.createElement('div');
  snowContainer.classList.add('snow-container');
  document.body.appendChild(snowContainer);

  function createSnowflake() {
    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    
    const startX = Math.random() * window.innerWidth;
    const delay = Math.random() * 10;
    const size = Math.random() * 3 + 1;
    
    snowflake.style.left = `${startX}px`;
    snowflake.style.width = `${size}px`;
    snowflake.style.height = `${size}px`;
    snowflake.style.animationDuration = `${randomBetween(10, 20)}s`;
    snowflake.style.animationDelay = `-${delay}s`;
    
    snowContainer.appendChild(snowflake);
    
    snowflake.addEventListener('animationiteration', () => {
      snowflake.remove();
      createSnowflake();
    });
  }

  const snowflakeCount = window.innerWidth < 768 ? 50 : 100;
  for (let i = 0; i < snowflakeCount; i++) {
    createSnowflake();
  }
}

function animate() {
  const container = document.querySelector('.floating-container');
  let currentY = 0;
  let currentRotation = 0;
  
  function updatePosition() {
    const nextY = (Math.random() < 0.5) ? randomBetween(-30, -10) : randomBetween(10, 30);
    const nextRotation = (Math.random() < 0.5) ? randomBetween(-10, -2) : randomBetween(2, 10);
    
    container.animate([
      { transform: `translateY(${currentY}px) rotate(${currentRotation}deg)` },
      { transform: `translateY(${nextY}px) rotate(${nextRotation}deg)` },
      { transform: 'translateY(0px) rotate(0deg)' }
    ], {
      duration: 3000,
      easing: 'ease-in-out',
      fill: 'forwards'
    }).onfinish = () => {
      currentY = 0;
      currentRotation = 0;
      setTimeout(updatePosition, 100); 
    };
  }
  
  updatePosition();
}

let audioContext;
let currentTrackIndex = 0;
let tracks = [];
let currentSource = null;
let isPlaying = false;
let currentTrackDuration = 0;
let playbackStartTime = 0;
let animationFrameId = null;
let currentPlaybackPosition = 0;
let initialInteractionHandled = false;

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

async function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
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
    if (playPauseBtn) playPauseBtn.textContent = '►'; 
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
      console.log("AudioContext resumed during playTrack call.");
    } catch (e) {
      console.warn("Failed to resume AudioContext. User interaction might still be needed.", e);
      
      isPlaying = false;
      if (playPauseBtn) playPauseBtn.textContent = '►';
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
    currentSource.connect(audioContext.destination);
    currentSource.start(0, startTime);

    isPlaying = true;
    if (playPauseBtn) playPauseBtn.textContent = '❚❚'; 

   
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
    if (playPauseBtn) playPauseBtn.textContent = '►'; 
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
    if (playPauseBtn) playPauseBtn.textContent = '►'; 
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


async function handleFirstInteraction() {
  if (initialInteractionHandled) return; 

  console.log("First user interaction detected.");

  await initializeAudioContext(); 

  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
      console.log("AudioContext resumed by global interaction.");
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

  
  animate();
  createSnow();

  
  await loadAudioList();

  
  if (playPauseBtn) playPauseBtn.textContent = '►';
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
  }

  
  if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
  if (nextBtn) nextBtn.addEventListener('click', nextTrack);
  if (prevBtn) prevBtn.addEventListener('click', prevTrack);

  
  document.addEventListener('click', handleFirstInteraction, { once: true });
  document.addEventListener('keydown', handleFirstInteraction, { once: true });
});

//window.addEventListener('load', () => {
//  animate();
  //createSnow();
//});
