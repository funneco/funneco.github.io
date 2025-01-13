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

window.addEventListener('load', () => {
  animate();
  createSnow();
});