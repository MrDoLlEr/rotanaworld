// Actual WebGL point geometry, a perspective camera and world-space depth motion.
function mountRotanaParticles(host) {
  const events = new AbortController();
  const layer = document.createElement("div");
  layer.className = "rotana-particle-background";
  layer.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  layer.append(canvas);
  host.append(layer);
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) {
    canvas.dataset.renderer = "unavailable";
    return () => layer.remove();
  }
  const vertex = `
    precision highp float;
    attribute vec3 a_position;
    attribute float a_kind;
    attribute float a_size;
    attribute float a_alpha;
    uniform mat4 u_view;
    uniform mat4 u_projection;
    uniform float u_time;
    uniform float u_dpr;
    uniform vec2 u_ptr;
    uniform float u_hover;
    uniform vec2 u_clickPos;
    uniform float u_clickT;
    uniform float u_pulseT;
    uniform float u_assemble;
    uniform vec2 u_look;
    varying float v_alpha;
    varying float v_green;
    varying float v_white;
    varying float v_flash;
    float hash(vec3 q){ return fract(sin(dot(q, vec3(12.9898,78.233,37.719)))*43758.5453); }
    void main(){
      v_white=step(1.1,a_kind)*(1.0-step(1.5,a_kind));
      vec3 p=a_position;
      float alpha=a_alpha;
      v_flash=0.0;
      if(a_kind<0.5){
        // A continuous 3D surface: each crest travels across the point grid.
        float x=a_position.x;
        float z=a_position.z;
        float phase=x*0.36+z*0.16-u_time*0.084;
        float wave=sin(phase)*0.85+sin(phase*0.53+z*0.10-u_time*0.024)*0.28;
        // Soft hill under the cursor, a ripple ring on click and a notification pulse from the globe.
        float d=length(vec2(x,z)-u_ptr);
        wave+=exp(-d*d*0.06)*1.8*u_hover;
        float dc=length(vec2(x,z)-u_clickPos);
        float ring=sin(dc*1.4-u_clickT*7.0)*exp(-u_clickT*0.6)*exp(-dc*0.07)*step(0.0,u_clickT*9.0-dc);
        wave+=ring*2.0;
        float dp=length(vec2(x,z+4.0));
        float pd=dp-u_pulseT*10.0;
        float pulse=exp(-pd*pd*0.35)*exp(-u_pulseT*0.55);
        wave+=pulse*2.1;
        v_flash=pulse+abs(ring)*0.5;
        p=vec3(x,-3.8+x*x*0.018+wave,z);
        alpha*=smoothstep(-25.0,-17.0,z)*(1.0-smoothstep(3.0,6.0,z));
        alpha*=1.0+v_flash*1.6;
      }else if(a_kind<1.5){
        // Globe and its divider use one shared model rotation in real XYZ space.
        // The globe turns slightly toward the pointer and assembles from the floor on entry.
        float yaw=sin(u_time*0.13)*0.19+u_look.x*0.7;
        float pitch=sin(u_time*0.10)*0.055+u_look.y*0.25;
        float x=p.x*cos(yaw)+p.z*sin(yaw);
        float z=p.z*cos(yaw)-p.x*sin(yaw);
        float y=p.y*cos(pitch)-z*sin(pitch);
        z=p.y*sin(pitch)+z*cos(pitch);
        float breathe=1.0+exp(-u_pulseT*3.0)*0.08;
        vec3 target=vec3(x,y,z)*1.8*breathe+vec3(0.0,2.02,-4.0);
        float r=hash(a_position);
        vec3 scatter=vec3((r-0.5)*30.0,-3.8+hash(a_position.zyx)*0.6,-22.0+hash(a_position.yxz)*24.0);
        p=mix(scatter,target,smoothstep(r*0.45,r*0.45+0.55,u_assemble));
        alpha*=0.65+0.35*smoothstep(-1.0,0.6,z);
        v_flash=exp(-u_pulseT*2.5)*0.8;
        alpha*=1.0+v_flash;
      }else{
        // Sparse green points rising in the same 3D world.
        float life=fract(a_position.y+u_time*0.005);
        p=vec3(a_position.x*15.0,-3.0+life*15.0,-26.0+a_position.z*29.0);
        alpha*=smoothstep(0.0,0.12,life)*(1.0-smoothstep(0.78,1.0,life));
      }
      vec4 viewPosition=u_view*vec4(p,1.0);
      float depth=-viewPosition.z;
      gl_Position=u_projection*viewPosition;
      gl_PointSize=clamp(a_size*u_dpr*28.1/max(depth,1.0)*(1.0+v_flash*0.6),u_dpr*1.25,7.0*u_dpr);
      // Perspective size, distance fog and a low horizon establish visible depth.
      v_alpha=alpha*(1.0-smoothstep(19.0,49.0,depth)*0.65)*step(0.4,depth)*1.6;
      v_green=0.72+0.28*(1.0-smoothstep(6.0,37.0,depth));
    }`;
  const fragment = `
    precision mediump float;
    varying float v_alpha;
    varying float v_green;
    varying float v_white;
    varying float v_flash;
    uniform vec3 u_tint;
    void main(){
      float r=length(gl_PointCoord-vec2(0.5))*2.0;
      if(r>1.0)discard;
      float core=1.0-smoothstep(0.32,0.95,r);
      float halo=(1.0-r)*(1.0-r)*0.18;
      vec3 base=mix(u_tint*v_green,vec3(1.0),clamp(v_flash*0.35,0.0,0.6));
      gl_FragColor=vec4(mix(base,vec3(1.0),v_white),(core+halo*(1.0-v_white))*v_alpha);
    }`;
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const program = gl.createProgram();
  try {
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    canvas.dataset.renderer = "shader-error";
    console.error("Particle renderer:", error);
    return () => layer.remove();
  }
  gl.useProgram(program);
  const positions = [],
    kinds = [],
    sizes = [],
    alphas = [];
  function add(x, y, z, kind, size, alpha) {
    positions.push(x, y, z);
    kinds.push(kind);
    sizes.push(size);
    alphas.push(alpha);
  }
  const mobile = innerWidth < 680;
  // Sample one surface, without overlapping/fading copies of each point.
  const columns = mobile ? 84 : 144,
    rows = mobile ? 40 : 64;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const u = col / (columns - 1),
        v = row / (rows - 1);
      const edge = Math.pow(Math.sin(u * Math.PI), 0.65);
      add((u * 2 - 1) * 24, 0, 5 - v * 30, 0, 1.9, 0.52 * edge);
    }
  const trace = document.createElement("canvas").getContext("2d");
  const divider = new Path2D(
    "M13 309C44 408 136 397 225 320C306 250 365 146 425 146C470 146 507 171 533 204C502 186 478 181 457 196C415 226 366 348 286 422C204 499 84 495 37 405C24 379 16 345 13 309Z",
  );
  const n = mobile ? 420 : 680,
    golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n,
      r = Math.sqrt(1 - y * y),
      x = Math.cos(i * golden) * r,
      z = Math.sin(i * golden) * r;
    // Keep green shell points out of the divider on both hemispheres.
    if (trace.isPointInPath(divider, 275 + x * 265, 275 - y * 265)) continue;
    const hollow = 0.28 + 0.72 * Math.pow(1 - Math.abs(z), 0.7);
    add(x, y, z, 1, 2.2, 0.32 * hollow);
  }
  // Fine, dim white points trace only the front curved divider.
  for (let py = 16; py < 535; py += 12)
    for (let px = 16; px < 535; px += 12) {
      const x = (px - 275) / 265,
        y = (py - 275) / 265;
      if (x * x + y * y < 0.985 && trace.isPointInPath(divider, px, py))
        add(x, -y, Math.sqrt(1 - x * x - y * y), 1.25, 1.45, 0.38);
    }
  const fraction = (v) => v - Math.floor(v);
  for (let i = 0; i < (mobile ? 110 : 260); i++) {
    const x = fraction(Math.sin(i * 127.1 + 8) * 43758.5453),
      y = fraction(Math.sin(i * 311.7 + 4) * 23421.631),
      z = fraction(Math.sin(i * 74.7 + 6) * 9523.1);
    add(x * 2 - 1, y, z, 2, 2.6, 0.5);
  }
  function buffer(name, data, size) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, size, gl.FLOAT, false, 0, 0);
  }
  buffer("a_position", positions, 3);
  buffer("a_kind", kinds, 1);
  buffer("a_size", sizes, 1);
  buffer("a_alpha", alphas, 1);
  const uniforms = Object.fromEntries(
    [
      "u_view", "u_projection", "u_time", "u_dpr", "u_ptr", "u_hover",
      "u_clickPos", "u_clickT", "u_pulseT", "u_assemble", "u_look", "u_tint",
    ].map((n) => [
      n,
      gl.getUniformLocation(program, n),
    ]),
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0,
    height = 0,
    dpr = 1,
    time = 0,
    last = 0,
    request = 0,
    frame = 0;
  const target = { x: 0, y: 0 },
    pointer = { x: 0, y: 0 };
  // Rotana green by default; other code may retint via the "rotana:tint" event.
  const tint = [0.08, 1.0, 0.24],
    tintTarget = [0.08, 1.0, 0.24];
  let floorPtr = [0, -10],
    hover = 0,
    hoverTarget = 0,
    clickPos = [0, -10],
    clickT = 99,
    pulseT = 99,
    assemble = 0,
    lastInput = -1e9,
    lastScrollPulse = -1e9;
  // Approximate projection of a screen point onto the wave floor.
  function floorFromScreen(cx, cy) {
    const nx = (cx / width) * 2 - 1,
      k = Math.min(Math.max((cy / height - 0.5) / 0.5, 0), 1);
    return [nx * (6 + (1 - k) * 16), -24 + k * 28];
  }
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2),
      nf = 1 / (near - far);
    return new Float32Array([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (far + near) * nf,
      -1,
      0,
      0,
      2 * far * near * nf,
      0,
    ]);
  }
  const normalize = (a) => {
    const l = Math.hypot(...a);
    return a.map((v) => v / l);
  };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  function lookAt(eye, centre) {
    const z = normalize(eye.map((v, i) => v - centre[i])),
      x = normalize(cross([0, 1, 0], z)),
      y = cross(z, x);
    return new Float32Array([
      x[0],
      y[0],
      z[0],
      0,
      x[1],
      y[1],
      z[1],
      0,
      x[2],
      y[2],
      z[2],
      0,
      -dot(x, eye),
      -dot(y, eye),
      -dot(z, eye),
      1,
    ]);
  }
  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniformMatrix4fv(
      uniforms.u_projection,
      false,
      perspective(Math.PI / 3, width / height, 0.3, 65),
    );
    gl.uniform1f(uniforms.u_dpr, dpr);
    if (reduced.matches || document.hidden) draw();
  }
  function draw() {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix4fv(
      uniforms.u_view,
      false,
      lookAt([pointer.x * 0.6, 3.2 + pointer.y * 0.25, 12], [0, 1, -18]),
    );
    gl.uniform1f(uniforms.u_time, time);
    gl.uniform2f(uniforms.u_ptr, floorPtr[0], floorPtr[1]);
    gl.uniform1f(uniforms.u_hover, hover);
    gl.uniform2f(uniforms.u_clickPos, clickPos[0], clickPos[1]);
    gl.uniform1f(uniforms.u_clickT, clickT);
    gl.uniform1f(uniforms.u_pulseT, pulseT);
    gl.uniform1f(uniforms.u_assemble, assemble);
    gl.uniform2f(uniforms.u_look, pointer.x, pointer.y);
    gl.uniform3f(uniforms.u_tint, tint[0], tint[1], tint[2]);
    gl.drawArrays(gl.POINTS, 0, kinds.length);
    if (++frame % 30 === 0) canvas.dataset.frame = String(frame);
  }
  function tick(now) {
    const dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;
    time += dt;
    // Idle: after 3s without input, drift the target in a slow circle.
    if (performance.now() - lastInput > 3000) {
      const a = time * 0.35;
      target.x = Math.sin(a) * 0.65;
      target.y = Math.cos(a) * 0.4;
      floorPtr = [Math.sin(a) * 8, -8 + Math.cos(a) * 5];
      hoverTarget = 0.8;
    }
    const ease = 1 - Math.exp(-dt * 4.0);
    pointer.x += (target.x - pointer.x) * ease;
    pointer.y += (target.y - pointer.y) * ease;
    hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 4));
    for (let i = 0; i < 3; i++)
      tint[i] += (tintTarget[i] - tint[i]) * (1 - Math.exp(-dt * 2.2));
    clickT += dt;
    pulseT += dt;
    assemble += (1 - assemble) * (1 - Math.exp(-dt * 0.9));
    draw();
    request = requestAnimationFrame(tick);
  }
  function resume() {
    cancelAnimationFrame(request);
    last = 0;
    if (!reduced.matches && !document.hidden)
      request = requestAnimationFrame(tick);
    else {
      assemble = 1;
      draw();
    }
  }
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);
  canvas.dataset.renderer = "webgl-perspective";
  canvas.dataset.points = String(kinds.length);
  canvas.dataset.surface = "travelling-3d-wave";
  addEventListener("resize", resize, { passive: true, signal: events.signal });
  addEventListener(
    "pointermove",
    (e) => {
      lastInput = performance.now();
      target.x = (e.clientX / width - 0.5) * 2;
      target.y = (e.clientY / height - 0.5) * 2;
      floorPtr = floorFromScreen(e.clientX, e.clientY);
      hoverTarget = e.clientY / height > 0.5 ? 1 : 0.25;
    },
    { passive: true, signal: events.signal },
  );
  // Phones scroll instead of firing pointermove, so follow touches directly.
  function onTouch(e, start) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    lastInput = performance.now();
    target.x = (t.clientX / width - 0.5) * 2;
    target.y = (t.clientY / height - 0.5) * 2;
    floorPtr = floorFromScreen(t.clientX, t.clientY);
    hoverTarget = 1;
    if (start) {
      clickPos = floorFromScreen(t.clientX, t.clientY);
      clickT = 0;
    }
  }
  addEventListener("touchstart", (e) => onTouch(e, true), {
    passive: true,
    signal: events.signal,
  });
  addEventListener("touchmove", (e) => onTouch(e, false), {
    passive: true,
    signal: events.signal,
  });
  // Scrolling tilts the scene and sends a pulse from the globe, at most every 1.2s.
  addEventListener(
    "scroll",
    () => {
      const now = performance.now();
      lastInput = now;
      const max = Math.max(
        document.documentElement.scrollHeight - innerHeight,
        1,
      );
      const progress = Math.min(Math.max(scrollY / max, 0), 1);
      target.y = (progress - 0.5) * 1.6;
      if (now - lastScrollPulse > 1200) {
        lastScrollPulse = now;
        dispatchEvent(new Event("rotana:pulse"));
      }
    },
    { passive: true, signal: events.signal },
  );
  document.documentElement.addEventListener(
    "pointerleave",
    () => {
      target.x = target.y = 0;
      hoverTarget = 0;
    },
    { signal: events.signal },
  );
  addEventListener(
    "pointerdown",
    (e) => {
      clickPos = floorFromScreen(e.clientX, e.clientY);
      clickT = 0;
    },
    { passive: true, signal: events.signal },
  );
  // Hooks for the rest of the app: a pulse on new activity and a section tint.
  addEventListener("rotana:pulse", () => (pulseT = 0), { signal: events.signal });
  addEventListener(
    "rotana:tint",
    (e) => {
      const rgb = e.detail;
      if (Array.isArray(rgb) && rgb.length === 3) tintTarget.splice(0, 3, ...rgb);
    },
    { signal: events.signal },
  );
  document.addEventListener("visibilitychange", resume, {
    signal: events.signal,
  });
  reduced.addEventListener("change", resume, { signal: events.signal });
  resize();
  resume();
  return () => {
    events.abort();
    cancelAnimationFrame(request);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    layer.remove();
  };
}
window.mountRotanaParticles = mountRotanaParticles;
