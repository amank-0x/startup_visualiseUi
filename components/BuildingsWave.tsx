"use client";

import { useEffect, useRef } from "react";
import * as THREE from "./buildings-wave/three.r110.js";
import OBJLoader from "./buildings-wave/three.r110.objloader.js";
import OrbitControls from "./buildings-wave/three.r110.orbitcontrols.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: any = THREE;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Loader: any = OBJLoader;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Orbit: any = OrbitControls;

// ---------------------------------------------------------------------------
// Faithful port of buildings-wave-master/with-controls + scroll-driven:
//   • scroll progress 0 → 1 zooms camera into the city
//   • building color transitions #161616 → #ff2020 (red)
//   • spot-light (shadows) fades out; ambient holds visibility
// ---------------------------------------------------------------------------

function expoEaseOut(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

const lerp = (a: number, b: number, n: number) => (1 - n) * a + n * b;
const lineEq = (y2: number, y1: number, x2: number, x1: number, val: number) => {
  const m = (y2 - y1) / (x2 - x1);
  return m * val + (y1 - m * x1);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

// Colors that drive the scroll transition — created inside useEffect
// so the vendored THREE module is fully ready before we touch it.

export default function BuildingsWave() {
  const mountRef    = useRef<HTMLDivElement>(null);
  const scrollRef   = useRef(0);        // raw scroll progress 0-1

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Scene & renderer ────────────────────────────────────────────────
    // Dimmed, elegant cool-blue architectural palette:
    //   START → Dimmed cool slate blue (#364455)
    //   END   → Deep dimmed obsidian slate (#202a36)
    // Soft, moody, comfortable brightness before and after scrolling.
    const COLOR_START = new T.Color("#364455");
    const COLOR_END   = new T.Color("#202a36");

    const scene    = new T.Scene();
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = T.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // ── Fog ─────────────────────────────────────────────────────────────
    const FOG_COLOR = "#080c14";
    scene.fog = new T.Fog(FOG_COLOR, 35, 210);

    // ── Camera: Straight perspective moved slightly right ───────────────
    // Shifted slightly right (x=18.5) from dead-center (x=8.5)
    // Start: full overview (z=155, y=52).
    // End: slightly more zoomed-in on the buildings (z=72, y=30) for rich detail,
    // maintaining straight forward scroll with no side drift.
    const CAM_START = { x: 18.5, y: 52, z: 155 };
    const CAM_END   = { x: 18.5, y: 30, z:  72 };
    const lookTarget = new T.Vector3(13.5, 4, 8.5);

    const initW = mount.clientWidth  || window.innerWidth;
    const initH = mount.clientHeight || window.innerHeight;
    const camera = new T.PerspectiveCamera(20, initW / initH, 1, 1000);
    camera.position.set(CAM_START.x, CAM_START.y, CAM_START.z);
    camera.lookAt(lookTarget);
    scene.add(camera);

    renderer.setSize(initW, initH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const controls = new Orbit(camera, renderer.domElement);
    controls.enabled = false;

    // ── Lights: Dimmed, soft, non-glaring cool-blue spectrum ─────────────
    // Ambient light: muted pale ice fill for soft shadow detail without washing out
    const ambientLight = new T.AmbientLight("#dbeafe", 0.32);
    scene.add(ambientLight);

    // Main SpotLight: Dimmed beam casting crisp shadows without harsh glare
    const spotLight = new T.SpotLight("#e0f2fe", 0.85);
    spotLight.position.set(95, 160, 95);
    spotLight.target.position.set(8.5, 0, 8.5);
    scene.add(spotLight.target);
    spotLight.angle                 = Math.PI / 3.4;
    spotLight.penumbra              = 0.35;
    spotLight.castShadow            = true;
    spotLight.shadow.mapSize.width  = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.camera.near    = 10;
    spotLight.shadow.camera.far     = 400;
    spotLight.shadow.bias           = -0.0004;
    scene.add(spotLight);

    // Dimmed, soft cool-blue fill lights (gentle accents, no blinding intensity)
    const addPL = (c: string, i: number, x: number, y: number, z: number) => {
      const pl = new T.PointLight(c, i);
      pl.position.set(x, y, z);
      scene.add(pl);
    };
    addPL("#7dd3fc", 1.0,   8.5, 60,   8.5); // dimmed soft ice-blue in the center
    addPL("#93c5fd", 0.8, -15.0, 40,  45.0); // soft front fill
    addPL("#bae6fd", 0.7,  -7.0, 95, -90.0); // gentle top/back kicker
    addPL("#475569", 0.5, -35.0, 10, -45.0); // soft subtle contrast fill

    // ── Floor (Clean seamless dark ground, no shadow in blank spaces) ────
    const floorGeo = new T.PlaneGeometry(350, 350);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new T.Mesh(
      floorGeo,
      new T.MeshStandardMaterial({
        color: "#06090e",
        metalness: 0.1,
        roughness: 0.75,
      }),
    );
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── Background shape ──────────────────────────────────────────────────
    const bgShape = new T.Mesh(
      new T.PlaneGeometry(500, 150),
      new T.MeshPhysicalMaterial({ color: FOG_COLOR }),
    );
    bgShape.position.set(8.5, 15, -160);
    scene.add(bgShape);

    // ── Building material: Dimmed satin cool-blue ceramic finish ─────────
    const buildMat = new T.MeshPhysicalMaterial({
      color:              COLOR_START,
      metalness:          0.48,
      roughness:          0.52,
      clearcoat:          0.38,
      clearcoatRoughness: 0.2,
    });
    const liveColor = new T.Color().copy(COLOR_START);

    // ── Grid setup ───────────────────────────────────────────────────────
    const GRID_SIZE = 40;
    const BOX_SIZE  = 3;
    const group     = new T.Object3D();

    type Entry = {
      obj:      AnyObj;
      startY:   number;
      targetY:  number;
      delay:    number;
      duration: number;
      elapsed:  number;
      done:     boolean;
    };
    const entries: Entry[] = [];

    let disposed    = false;
    let rafId       = 0;
    let animStarted = false;

    // ── Load OBJ ─────────────────────────────────────────────────────────
    const objLoader = new Loader();
    objLoader.load(
      "/buildings-wave/buildings.obj",
      (obj: AnyObj) => {
        if (disposed) return;

        // Original: scale 0.01, position (0, -14, 0) on each prototype model
        const rawModels: AnyObj[] = (obj.children as AnyObj[]).map((m: AnyObj) => {
          m.scale.set(0.01, 0.01, 0.01);
          m.position.set(0, -14, 0);
          m.receiveShadow = true;
          m.castShadow    = true;
          return m;
        });
        if (!rawModels.length) return;

        // Original scale.y formula: Math.random() * (max - min + .01)
        // max=.009, min=.001  →  range = 0.019
        const RANGE = 0.009 - 0.001 + 0.01; // 0.019

        for (let i = 0; i < GRID_SIZE; i++) {
          for (let j = 0; j < GRID_SIZE; j++) {
            const src = rawModels[Math.floor(Math.random() * rawModels.length)];
            const b   = src.clone() as AnyObj;

            // Apply material to every Mesh child
            b.traverse((child: AnyObj) => {
              if (child.isMesh) {
                child.material      = buildMat;
                child.castShadow    = true;
                child.receiveShadow = true;
              }
            });

            b.position.x = i * BOX_SIZE;
            b.position.z = j * BOX_SIZE;
            // position.y stays at -14 (cloned from prototype) — underground
            b.scale.y    = Math.random() * RANGE;

            group.add(b);
            entries.push({
              obj:      b,
              startY:   b.position.y as number,   // -14
              targetY:  1,                         // original TweenMax target
              delay:    0,
              duration: 0,
              elapsed:  0,
              done:     false,
            });
          }
        }

        // Original group offset: (-gridSize - 10, 1, -gridSize - 10)
        group.position.set(-(GRID_SIZE + 10), 1, -(GRID_SIZE + 10));
        scene.add(group);

        // showBuildings(): sort by z descending (closest to camera first),
        // then assign TweenMax-equivalent delay + duration per index.
        entries.sort((a, b) => (b.obj.position.z as number) - (a.obj.position.z as number));
        entries.forEach((e, idx) => {
          e.delay    = idx / 4000;
          e.duration = 0.6 + idx / 4000;
        });

        animStarted = true;
      },
      undefined,
      () => { if (!disposed) console.error("BuildingsWave: failed to load buildings.obj"); },
    );

    // ── Mouse tracking ───────────────────────────────────────────────────
    let mouseX = 3;
    let lastMouseX = 3;
    const onMouseMove = (ev: MouseEvent) => { mouseX = ev.pageX; };
    window.addEventListener("mousemove", onMouseMove);

    // ── Scroll tracking ──────────────────────────────────────────────────
    // Longer scroll distance for a smooth, immersive experience
    const SCROLL_HEIGHT_VH = 8.0; // multiples of innerHeight
    const onScroll = () => {
      scrollRef.current = Math.min(
        window.scrollY / (window.innerHeight * SCROLL_HEIGHT_VH),
        1,
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── Smooth scroll state ───────────────────────────────────────────────
    let smoothProgress = 0;
    let currentCamX    = CAM_START.x;
    let currentCamY    = CAM_START.y;
    let currentCamZ    = CAM_START.z;

    // ── Resize ───────────────────────────────────────────────────────────
    const onResize = () => {
      const nw = mount.clientWidth  || window.innerWidth;
      const nh = mount.clientHeight || window.innerHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    // ── Render loop ───────────────────────────────────────────────────────
    let lastTime = 0;

    const animate = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const cw = mount.clientWidth  || window.innerWidth;
      const ch = mount.clientHeight || window.innerHeight;

      // Smooth scroll progress
      smoothProgress += (scrollRef.current - smoothProgress) * 0.035;
      const p = smoothProgress; // 0 → 1

      // ── Camera: Straight scroll forward shifted slightly right ──────────
      // Both start and end X are 18.5, keeping movement strictly straight.
      const targetCamX = 18.5;
      const targetCamY = lerp(CAM_START.y, CAM_END.y, p);
      const targetCamZ = lerp(CAM_START.z, CAM_END.z, p);

      currentCamX = lerp(currentCamX, targetCamX, 0.05);
      currentCamY = lerp(currentCamY, targetCamY, 0.05);
      currentCamZ = lerp(currentCamZ, targetCamZ, 0.05);

      // Mouse X: subtle horizontal tilt only (-3 to +3), zero vertical wobble
      const mouseOffset = lineEq(-3, 3, cw, 0, mouseX);
      lastMouseX = lerp(lastMouseX, currentCamX + mouseOffset, 0.05);

      camera.position.set(lastMouseX, currentCamY, currentCamZ);

      // Aim straight down the avenue with a balanced perspective
      lookTarget.set(13.5, lerp(4, 2, p), lerp(8.5, 0, p));
      camera.lookAt(lookTarget);

      // ── Material: Cool professional tone that becomes clearer on zoom ─────
      // Graphite slate -> deep titanium obsidian
      liveColor.copy(COLOR_START).lerp(COLOR_END, p);
      buildMat.color.copy(liveColor);

      // Dimmed high-definition clarity:
      buildMat.roughness = lerp(0.52, 0.28, p);
      buildMat.metalness = lerp(0.48, 0.55, p);
      buildMat.clearcoat = lerp(0.38, 0.65, p);

      // ── Fog: pushes back as we zoom in so buildings become crystal clear ──
      scene.fog.near = lerp(35, 80, p);
      scene.fog.far  = lerp(210, 440, p);

      // ── Lighting & Shadows: Dimmed, comfortable lighting throughout ──────
      spotLight.intensity    = lerp(0.85, 0.70, p);
      ambientLight.intensity = lerp(0.32, 0.40, p);

      // ── Building wave animation (TweenMax replacement) ────────────────────
      if (animStarted) {
        entries.forEach((e) => {
          if (e.done) return;
          e.elapsed += dt;
          const t = e.elapsed - e.delay;
          if (t <= 0) return;
          const progress = Math.min(t / e.duration, 1);
          e.obj.position.y = e.startY + (e.targetY - e.startY) * expoEaseOut(progress);
          if (progress >= 1) e.done = true;
        });
      }

      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      controls.dispose?.();
      scene.traverse((o: AnyObj) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <>
      {/*
        Scroll track: 1000 vh tall, transparent, sits in normal flow.
        Provides a longer, smoother, more expansive scrolling experience.
      */}
      <div style={{ position: "relative", height: "1000vh", width: "100%" }} />

      {/* Three.js canvas — fixed, always full-screen */}
      <div
        ref={mountRef}
        style={{
          position:   "fixed",
          inset:      0,
          width:      "100%",
          height:     "100%",
          background: "#080c14",   // dimmed deep obsidian background
          zIndex:     -1,
        }}
      />
    </>
  );
}
