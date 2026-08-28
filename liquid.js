/* ==========================================================================
   DRK — dark liquid glass
   A single full-panel fragment shader: domain-warped flow builds a height
   field, the height field is lit as a sheet of black crystal over water.
   No libraries, one draw call, adaptive resolution.
   ========================================================================== */

(function () {
  "use strict";

  var panel = document.getElementById("panel");
  var canvas = document.getElementById("liquid");
  if (!panel || !canvas) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var gl = canvas.getContext("webgl", {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false
  }) || canvas.getContext("experimental-webgl");

  /* ---- graceful fallback: a still, plausible piece of dark glass ---------- */
  if (!gl) {
    canvas.style.background =
      "radial-gradient(120% 140% at 78% 34%, rgba(0,224,96,.22), transparent 52%)," +
      "radial-gradient(90% 120% at 92% 78%, rgba(120,150,140,.10), transparent 60%)," +
      "linear-gradient(105deg, #000 0%, #030604 46%, #071009 100%)";
    return;
  }

  /* ======================================================================== */
  /* SHADERS                                                                  */
  /* ======================================================================== */

  var VERT = [
    "attribute vec2 aPos;",
    "void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }"
  ].join("\n");

  var FRAG = [
    "precision highp float;",

    "uniform vec2  uRes;",
    "uniform float uTime;",
    "uniform vec2  uMouse;",   /* aspect-space cursor                          */
    "uniform float uHover;",   /* 0..1 presence of the cursor                  */
    "uniform vec2  uPar;",     /* parallax offset                              */
    "uniform vec3  uRip[3];",  /* xy = origin, z = age in seconds (<0 = idle)  */
    "uniform float uAccentY;", /* 0..1 vertical focus from the category rail   */
    "uniform float uAccentA;", /* 0..1 strength of that focus                  */

    /* ---- simplex noise (Ashima / Gustavson) ---- */
    "vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }",
    "vec2 mod289(vec2 x){ return x - floor(x*(1.0/289.0))*289.0; }",
    "vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }",
    "float snoise(vec2 v){",
    "  const vec4 C = vec4(0.211324865405187, 0.366025403784439,",
    "                     -0.577350269189626, 0.024390243902439);",
    "  vec2 i  = floor(v + dot(v, C.yy));",
    "  vec2 x0 = v - i + dot(i, C.xx);",
    "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
    "  vec4 x12 = x0.xyxy + C.xxzz;",
    "  x12.xy -= i1;",
    "  i = mod289(i);",
    "  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))",
    "                          + i.x + vec3(0.0, i1.x, 1.0));",
    "  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);",
    "  m = m*m; m = m*m;",
    "  vec3 x  = 2.0 * fract(p * C.www) - 1.0;",
    "  vec3 h  = abs(x) - 0.5;",
    "  vec3 ox = floor(x + 0.5);",
    "  vec3 a0 = x - ox;",
    "  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);",
    "  vec3 g;",
    "  g.x  = a0.x  * x0.x   + h.x  * x0.y;",
    "  g.yz = a0.yz * x12.xz + h.yz * x12.yw;",
    "  return 130.0 * dot(m, g);",
    "}",

    /* Three soft octaves. Deliberately few: this surface is a swell, not a
       texture — the moment a fourth octave goes in it reads as noise. */
    /* Three soft octaves. Deliberately few: this is a swell, not a texture. */
    "float fbm(vec2 p){",
    "  float f  = 0.55 * snoise(p);",
    "  p = p * 2.03 + 9.1;   f += 0.28 * snoise(p);",
    "  p = p * 2.01 + 4.7;   f += 0.13 * snoise(p);",
    "  return f;",
    "}",

    /* one faint filament layer for the hair-fine strands along the crests */
    "float surface(vec2 z, float t){",
    "  return fbm(z) + snoise(z * 2.3 + vec2(0.0, t * 0.45)) * 0.042;",
    "}",

    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / uRes;",
    "  float aspect = uRes.x / max(uRes.y, 1.0);",
    "  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);",

    "  p += uPar * 0.022;",

    "  float md = length(p - uMouse);",
    "  p += (p - uMouse) * exp(-md * md * 5.0) * 0.100 * uHover;",

    "  for(int i = 0; i < 3; i++){",
    "    vec3 R = uRip[i];",
    "    if(R.z >= 0.0){",
    "      float d = length(p - R.xy);",
    "      float wv = sin(d * 16.0 - R.z * 5.6)",
    "               * exp(-d * 2.6) * exp(-R.z * 1.7);",
    "      p += (p - R.xy) / max(d, 1e-4) * wv * 0.022;",
    "    }",
    "  }",

    /* ---- ROTATE INTO THE RIBBON FRAME.
       Everything below works along a 19-degree axis, so the sheets run up and
       to the right instead of lying flat across the panel. ---- */
    "  const float CA = 0.9205;",   /* cos 23deg */
    "  const float SA = 0.3907;",   /* sin 23deg */
    "  vec2 f = vec2(p.x * CA + p.y * SA, -p.x * SA + p.y * CA);",

    "  float t = uTime * 0.020;",

    /* 8:1 anisotropy makes ribbons rather than blobs; the warp is small so they
       stay coherent, and the drift runs ALONG the flow so the sheet rises. */
    "  vec2 sp = vec2(f.x * 0.36, f.y * 1.62);",
    "  vec2 q  = vec2(fbm(sp * 0.62 + vec2(t * 0.55, 0.0)),",
    "                 fbm(sp * 0.62 + vec2(3.1, 1.7) - t * 0.42));",
    "  vec2 base = sp + 0.62 * q + vec2(-t * 1.15, t * 0.10);",

    "  float e  = 0.012;",
    "  float h  = surface(base,                  uTime);",
    "  float hx = surface(base + vec2(e, 0.0),   uTime);",
    "  float hy = surface(base + vec2(0.0, e),   uTime);",
    "  vec3  n  = normalize(vec3((h - hx) / e, (h - hy) / e, 1.35));",
    /* the light lives in screen space, so bring the normal back out of the
       ribbon frame before shading */
    "  n.xy = vec2(n.x * CA - n.y * SA, n.x * SA + n.y * CA);",

    "  float ridge = clamp(1.0 - abs(h), 0.0, 1.0);",

    /* ---- the green rides ONE ribbon edge, bending with the flow ---- */
    "  float bandY = f.y - 0.098 + 0.13 * q.y;",
    "  float gm = exp(-bandY * bandY * 42.0);",
    "  gm *= smoothstep(0.22, 0.74, uv.x);",
    "  gm *= 0.42 + 0.58 * smoothstep(0.25, 0.95, ridge);",
    "  gm *= 0.86 + 0.14 * sin(uTime * 0.13 + h * 1.8);",
    "  gm += 0.46 * exp(-(pow((uv.x - 0.88) * 2.3, 2.0) + pow((uv.y - 0.90) * 2.5, 2.0)));",
    "  gm += exp(-pow((uv.y - uAccentY) * 3.0, 2.0)) * uAccentA * 0.40 * smoothstep(0.34, 1.0, uv.x);",

    /* ---- lighting ---- */
    "  vec3 V = vec3(0.0, 0.0, 1.0);",
    "  vec3 H1 = normalize(normalize(vec3(0.52, 0.50, 0.70)) + V);",
    "  float nh1   = max(dot(n, H1), 0.0);",
    "  float glint = pow(nh1, 60.0);",
    "  float sheen = pow(nh1, 11.0);",

    "  vec3 H2 = normalize(normalize(vec3(-0.34, 0.62, 0.56)) + V);",
    "  float gspec = pow(max(dot(n, H2), 0.0), 22.0);",

    "  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);",

    /* ---- assembly: black chrome first, green only on the one sweep ---- */
    "  const vec3 SIG = vec3(0.0, 0.878, 0.376);",
    "  vec3 col = vec3(0.005, 0.007, 0.006);",

    "  col += vec3(0.012, 0.020, 0.019) * (0.28 + 0.72 * ridge) * 0.68;",
    "  col += vec3(0.082, 0.094, 0.089) * sheen * 0.86;",
    "  col += vec3(1.0, 1.0, 0.99) * glint * 0.80;",
    "  col += SIG * gspec * gm * 1.90;",
    "  col += SIG * pow(ridge, 7.0) * gm * 0.26;",
    "  col += vec3(0.45, 1.0, 0.68) * pow(ridge, 22.0) * gm * 1.75;",
    "  col += (vec3(0.072, 0.098, 0.094) + SIG * 0.26 * gm) * fres * 0.78;",

    /* ---- black under the type, calm at the rail and the footer ---- */
    "  float portrait = 1.0 - smoothstep(0.95, 1.45, aspect);",
    "  float guard = mix(smoothstep(0.08, 0.58, uv.x), 1.0, portrait);",
    "  col *= mix(0.07, 1.0, guard);",
    "  col *= 1.0 - 0.66 * (1.0 - portrait) * smoothstep(0.76, 1.02, uv.x);",
    "  col *= 1.0 - 0.34 * smoothstep(0.78, 1.04, uv.y);",
    "  col *= 1.0 - 0.46 * smoothstep(0.28, -0.04, uv.y);",

    "  col = col / (1.0 + col * 0.40);",
    "  col = pow(max(col, 0.0), vec3(0.92));",

    "  float gr = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.545 + uTime);",
    "  col += (gr - 0.5) * 0.010;",

    "  gl_FragColor = vec4(max(col, 0.0), 1.0);",
    "}"
  ].join("\n");

  /* ======================================================================== */
  /* PROGRAM                                                                  */
  /* ======================================================================== */

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("[drk] shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("[drk] link:", gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {
    res:     gl.getUniformLocation(prog, "uRes"),
    time:    gl.getUniformLocation(prog, "uTime"),
    mouse:   gl.getUniformLocation(prog, "uMouse"),
    hover:   gl.getUniformLocation(prog, "uHover"),
    par:     gl.getUniformLocation(prog, "uPar"),
    rip:     gl.getUniformLocation(prog, "uRip"),
    accentY: gl.getUniformLocation(prog, "uAccentY"),
    accentA: gl.getUniformLocation(prog, "uAccentA")
  };

  /* ======================================================================== */
  /* SIZING — render below native and let the glass upscale. It is soft by     */
  /* nature, so the saved fill rate costs nothing visible.                     */
  /* ======================================================================== */

  var coarse = window.matchMedia("(pointer: coarse)").matches;
  var quality = coarse ? 0.62 : 0.84;
  var W = 1, H = 1;

  function resize() {
    var r = panel.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width  * dpr * quality));
    var h = Math.max(1, Math.round(r.height * dpr * quality));
    if (w === W && h === H) return;
    W = w; H = h;
    canvas.width = W;
    canvas.height = H;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.res, W, H);
  }

  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(panel);
  } else {
    window.addEventListener("resize", resize);
  }
  resize();

  /* ======================================================================== */
  /* INTERACTION                                                              */
  /* ======================================================================== */

  var clock = 0, prev = 0, raf = 0, visible = true;
  var slow = 0, degrades = 0;

  var mouse = [0.42, 0.10], mTarget = [0.42, 0.10];
  var par   = [0, 0],       pTarget = [0, 0];
  var hover = 0,            hTarget = 0;
  var accentY = 0.5,        accentA = 0, aYTarget = 0.5, aATarget = 0;

  var rip = new Float32Array(9);
  rip[2] = rip[5] = rip[8] = -1;
  var ripSlot = 0, travel = 0, lastRipple = -1;

  function emit(x, y) {
    var i = ripSlot * 3;
    rip[i] = x; rip[i + 1] = y; rip[i + 2] = 0;
    ripSlot = (ripSlot + 1) % 3;
  }

  if (!reduce) {
    panel.addEventListener("pointermove", function (ev) {
      var r = panel.getBoundingClientRect();
      var ax = r.width / Math.max(r.height, 1);
      var nx = ((ev.clientX - r.left) / r.width  - 0.5) * ax;
      var ny = 0.5 - (ev.clientY - r.top) / r.height;

      travel += Math.hypot(nx - mTarget[0], ny - mTarget[1]);
      mTarget[0] = nx; mTarget[1] = ny;
      pTarget[0] = nx * 0.5; pTarget[1] = ny * 0.5;
      hTarget = 1;

      /* sustained movement leaves a wake, but only now and then */
      if (travel > 0.62 && clock - lastRipple > 0.34) {
        emit(nx, ny);
        travel = 0;
        lastRipple = clock;
      }
    }, { passive: true });

    panel.addEventListener("pointerdown", function (ev) {
      var r = panel.getBoundingClientRect();
      var ax = r.width / Math.max(r.height, 1);
      emit(((ev.clientX - r.left) / r.width - 0.5) * ax,
           0.5 - (ev.clientY - r.top) / r.height);
      lastRipple = clock;
    }, { passive: true });

    panel.addEventListener("pointerleave", function () {
      hTarget = 0;
      pTarget[0] = 0; pTarget[1] = 0;
    }, { passive: true });

    /* the category rail bends the light toward whatever is being read */
    var links = document.querySelectorAll(".nav-col a[data-accent]");
    Array.prototype.forEach.call(links, function (a) {
      function on()  { aYTarget = 1 - parseFloat(a.dataset.accent); aATarget = 1; }
      function off() { aATarget = 0; }
      a.addEventListener("pointerenter", on);
      a.addEventListener("focus", on);
      a.addEventListener("pointerleave", off);
      a.addEventListener("blur", off);
    });
  }

  /* ======================================================================== */
  /* LOOP                                                                     */
  /* ======================================================================== */

  function draw(dt) {
    var k = 1 - Math.pow(0.001, dt);          /* frame-rate independent easing */

    mouse[0] += (mTarget[0] - mouse[0]) * k;
    mouse[1] += (mTarget[1] - mouse[1]) * k;
    par[0]   += (pTarget[0] - par[0]) * k * 0.45;
    par[1]   += (pTarget[1] - par[1]) * k * 0.45;
    hover    += (hTarget - hover) * k * 0.6;
    accentY  += (aYTarget - accentY) * k * 0.7;
    accentA  += (aATarget - accentA) * k * 0.7;

    for (var i = 0; i < 3; i++) {
      if (rip[i * 3 + 2] >= 0) {
        rip[i * 3 + 2] += dt;
        if (rip[i * 3 + 2] > 4.2) rip[i * 3 + 2] = -1;
      }
    }

    gl.uniform1f(U.time, clock);
    gl.uniform2f(U.mouse, mouse[0], mouse[1]);
    gl.uniform1f(U.hover, hover);
    gl.uniform2f(U.par, par[0], par[1]);
    gl.uniform3fv(U.rip, rip);
    gl.uniform1f(U.accentY, accentY);
    gl.uniform1f(U.accentA, accentA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0.016;
    prev = now;
    clock += dt;

    /* if the GPU cannot hold the frame, drop resolution rather than motion */
    if (degrades < 2) {
      slow = dt > 0.028 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 45) {
        quality = Math.max(0.4, quality * 0.78);
        degrades++; slow = 0;
        W = H = 0; resize();
      }
    }
    draw(dt);
  }

  function start() {
    if (raf || !visible) return;
    prev = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
    visible ? start() : stop();
  });

  if (reduce) {
    /* a single, still frame of glass — the composition, none of the motion */
    clock = 21.4;
    draw(0.016);
  } else {
    start();
  }

  requestAnimationFrame(function () { document.body.classList.add("ready"); });
})();
