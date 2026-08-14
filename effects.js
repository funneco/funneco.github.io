(async () => {
const THREE = await import("https://esm.sh/three@0.180.0");

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

async function createGlassObject() {
  const host = document.querySelector("#glass-object");
  const canvas = document.querySelector("#glass-canvas");
  if (!host || !canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, -0.35, 14);

  const GLASS_OBJECT_SRC = "/grin.png";
  const sourceImage = new Image();
  sourceImage.src = GLASS_OBJECT_SRC;
  await sourceImage.decode();
  const traceCanvas = document.createElement("canvas");
  traceCanvas.width = traceCanvas.height = 256;
  const traceContext = traceCanvas.getContext("2d", { willReadFrequently: true });
  traceContext.drawImage(sourceImage, 0, 0, 256, 256);
  const pixels = traceContext.getImageData(0, 0, 256, 256).data;
  const points = [];
  const rayCount = 160;
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    let edge = 0;
    for (let radius = 0; radius <= 181; radius += 0.75) {
      const x = Math.round(128 + Math.cos(angle) * radius);
      const y = Math.round(128 + Math.sin(angle) * radius);
      if (x < 0 || y < 0 || x > 255 || y > 255) break;
      if (pixels[(y * 256 + x) * 4 + 3] > 64) edge = radius;
    }
    points.push(new THREE.Vector2(
      Math.cos(angle) * edge * (3.35 / 256),
      -Math.sin(angle) * edge * (3.35 / 256),
    ));
  }
  const curve = new THREE.CatmullRomCurve3(
    points.map(point => new THREE.Vector3(point.x, point.y, 0)),
    true,
    "centripetal",
  );
  const smoothPoints = curve.getPoints(240);
  const shape = new THREE.Shape();
  shape.moveTo(smoothPoints[0].x, smoothPoints[0].y);
  smoothPoints.slice(1).forEach(point => shape.lineTo(point.x, point.y));
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 8,
    bevelSize: 0.11,
    bevelThickness: 0.08,
    curveSegments: 16,
  });
  geometry.center();

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    thickness: 4,
    ior: 1.75,
    roughness: 0.18,
    dispersion: 1.5,
    clearcoat: 0.5,
    clearcoatRoughness: 0.06,
    attenuationColor: new THREE.Color("#ffff00"),
    attenuationDistance: 1.5,
    transparent: true,
    opacity: 1,
  });
  const slab = new THREE.Mesh(geometry, glass);
  const glassObject = new THREE.Group();
  glassObject.add(slab);

  const grinTexture = new THREE.Texture(sourceImage);
  grinTexture.colorSpace = THREE.SRGBColorSpace;
  grinTexture.needsUpdate = true;
  const artwork = new THREE.Mesh(
    new THREE.PlaneGeometry(3.35, 3.35),
    new THREE.MeshBasicMaterial({
      map: grinTexture,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  artwork.position.z = 0.185;
  glassObject.add(artwork);
  const floatGroup = new THREE.Group();
  floatGroup.add(glassObject);
  scene.add(floatGroup);

  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const key = new THREE.PointLight(0xff244f, 55, 20);
  key.position.set(-3, 4, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0x5177ff, 75, 20);
  rim.position.set(4, -2, 2);
  scene.add(rim);
  const top = new THREE.RectAreaLight(0xffffff, 10, 5, 1);
  top.position.set(0, 4, 3);
  top.lookAt(0, 0, 0);
  scene.add(top);

  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  let velocityX = 0;
  let velocityY = 0;
  host.addEventListener("pointerdown", event => {
    dragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
    host.setPointerCapture(event.pointerId);
  });
  host.addEventListener("pointermove", event => {
    if (!dragging) return;
    velocityY = (event.clientX - previousX) * 0.012;
    velocityX = (event.clientY - previousY) * 0.012;
    glassObject.rotation.y += velocityY;
    glassObject.rotation.x += velocityX;
    previousX = event.clientX;
    previousY = event.clientY;
  });
  const stopDragging = event => {
    dragging = false;
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
  };
  host.addEventListener("pointerup", stopDragging);
  host.addEventListener("pointercancel", stopDragging);

  let targetCameraDistance = camera.position.z;
  host.addEventListener("wheel", event => {
    event.preventDefault();
    targetCameraDistance = THREE.MathUtils.clamp(
      targetCameraDistance + event.deltaY * 0.006,
      1.5,
      25,
    );
  }, { passive: false });

  function resize() {
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  window.addEventListener("resize", resize);
  resize();

  const FLOAT_INTENSITY = 2;
  const ROCKING_INTENSITY = 1.2;
  const FLOAT_SPEED = 1.3;
  let lastFrameTime = 0;
  let floatElapsed = Math.random() * 100;

  function render(time) {
    const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.1) : 0;
    lastFrameTime = time;
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCameraDistance, 0.12);
    if (!dragging && !reduceMotion) {
      glassObject.rotation.x += velocityX;
      glassObject.rotation.y += velocityY;
      velocityX *= 0.94;
      velocityY *= 0.94;
    }
    if (!reduceMotion) {
      floatElapsed += delta * FLOAT_SPEED;
      floatGroup.rotation.x = (Math.cos(floatElapsed / 4) / 8) * ROCKING_INTENSITY;
      floatGroup.rotation.y = (Math.sin(floatElapsed / 4) / 8) * ROCKING_INTENSITY;
      floatGroup.rotation.z = (Math.sin(floatElapsed / 4) / 20) * ROCKING_INTENSITY;
      floatGroup.position.y = (Math.sin(floatElapsed / 1.5) / 10) * FLOAT_INTENSITY;
    } else {
      floatGroup.position.y = 0;
      floatGroup.rotation.set(0, 0, 0);
    }
    glassObject.updateWorldMatrix(true, false);
    const cameraOnFront = glassObject.worldToLocal(camera.position.clone()).z >= 0;

    slab.renderOrder = cameraOnFront ? 0 : 2;
    artwork.renderOrder = cameraOnFront ? 2 : 0;
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function createRipple() {
  const canvas = document.querySelector("#ripple-background");
  const gl = canvas?.getContext("webgl2", { alpha: false, antialias: false });
  if (!canvas || !gl) return;

  const vertex = `#version 300 es
    layout(location=0) in vec2 p; out vec2 uv;
    void main(){ uv=p*.5+.5; gl_Position=vec4(p,0.,1.); }`;
  const fragment = `#version 300 es
    precision highp float; in vec2 uv; out vec4 color;
    uniform vec2 resolution; uniform vec4 ripples[12]; uniform int count; uniform float now;
    void main(){
      vec2 q=vec2(uv.x,1.-uv.y), px=q*resolution;
      vec2 grad=vec2(0.); float shine=0.;
      for(int i=0;i<12;i++){
        if(i>=count) break;
        vec4 wave=ripples[i]; float age=now-wave.z;
        if(age<0.) continue;
        vec2 d=px-wave.xy; float radius=length(d); float front=age*230.;
        float s=radius-front; float env=exp(-s*s/5200.)*exp(-age*.52)*wave.w;
        float h=sin(s*.085)*env; grad+=normalize(d+vec2(.001))*h;
      }
      vec2 warped=q+grad*0.010;
      float vignette=1.-smoothstep(.15,.85,length(warped-.5));
      vec3 base=mix(vec3(.002),vec3(.018),max(0.,1.-length(warped-vec2(.5,.43))*1.7));
      base+=vec3(.035)*vignette*.18;
      shine=max(0.,dot(grad,normalize(vec2(-.6,-.8))));
      base+=vec3(1.)*pow(shine,2.)*.72;
      base-=vec3(.08)*max(0.,dot(grad,normalize(vec2(.6,.8))));
      color=vec4(base,1.);
    }`;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program); gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const resolution = gl.getUniformLocation(program, "resolution");
  const count = gl.getUniformLocation(program, "count");
  const now = gl.getUniformLocation(program, "now");
  const wavesUniform = gl.getUniformLocation(program, "ripples");
  const waves = [];
  const started = performance.now() / 1000;

  function splash(x, y, strength = 1) {
    if (reduceMotion) return;
    if (waves.length === 12) waves.shift();
    waves.push([x, y, performance.now() / 1000 - started, strength]);
  }
  addEventListener("click", event => splash(event.clientX, event.clientY, 1));

  function draw(ms) {
    const dpr = Math.min(devicePixelRatio, 2);
    const width = Math.round(innerWidth*dpr), height = Math.round(innerHeight*dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width=width; canvas.height=height; }
    gl.viewport(0,0,width,height); gl.useProgram(program);
    gl.uniform2f(resolution,width,height); gl.uniform1i(count,waves.length); gl.uniform1f(now,ms/1000-started);
    const data = new Float32Array(48);
    waves.forEach((w,i)=>{ data.set([w[0]*dpr,w[1]*dpr,w[2],w[3]],i*4); });
    gl.uniform4fv(wavesUniform,data); gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

createRipple();
await createGlassObject();
})().catch(error => console.error("Could not initialize canvas effects:", error));
