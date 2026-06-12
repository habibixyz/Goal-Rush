import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function SoccerBall3D() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 200;

    // --- Scene Setup ---
    const scene = new THREE.Scene();

    // --- Camera Setup ---
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 6.5;

    // --- Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 5, 4);
    scene.add(dirLight);

    const blueLight = new THREE.PointLight(0x2E3EFE, 3, 10);
    blueLight.position.set(-3, 2, 2);
    scene.add(blueLight);

    const orangeLight = new THREE.PointLight(0xFF5C00, 3, 10);
    orangeLight.position.set(3, -2, 2);
    scene.add(orangeLight);

    // --- Procedural Soccer Ball Texture ---
    const createBallTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      // 1. Base White Leather Color
      ctx.fillStyle = '#f9f9fb';
      ctx.fillRect(0, 0, 1024, 512);

      // 2. Draw Classic Black Pentagons using 12 vertices of Icosahedron mapped to UV
      ctx.fillStyle = '#1e1e24';
      ctx.strokeStyle = '#d4d4d8';
      ctx.lineWidth = 4;

      const vertices = [
        { lat: Math.PI / 2, lon: 0 },
        { lat: -Math.PI / 2, lon: 0 }
      ];
      const latVal = Math.atan(0.5);
      for (let i = 0; i < 5; i++) {
        vertices.push({ lat: latVal, lon: (i * 72 * Math.PI) / 180 });
        vertices.push({ lat: -latVal, lon: ((i * 72 + 36) * Math.PI) / 180 });
      }

      // Draw pentagonal panels
      vertices.forEach(v => {
        let lonNorm = v.lon;
        if (lonNorm > Math.PI) lonNorm -= 2 * Math.PI;
        const x = ((lonNorm + Math.PI) / (2 * Math.PI)) * 1024;
        const y = ((Math.PI / 2 - v.lat) / Math.PI) * 512;

        // Draw a neat solid pentagon
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const angle = (j * 72 * Math.PI) / 180 - Math.PI / 2;
          const px = x + Math.cos(angle) * 52;
          const py = y + Math.sin(angle) * 52;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw wrapping seams for borders
        if (x < 100) {
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            const angle = (j * 72 * Math.PI) / 180 - Math.PI / 2;
            const px = x + 1024 + Math.cos(angle) * 52;
            const py = y + Math.sin(angle) * 52;
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (x > 924) {
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            const angle = (j * 72 * Math.PI) / 180 - Math.PI / 2;
            const px = x - 1024 + Math.cos(angle) * 52;
            const py = y + Math.sin(angle) * 52;
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      });

      // 3. Draw World Cup Elegant Swoops (Royal Blue & Orange & Gold)
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#2E3EFE'; // Blue Swoosh
      ctx.beginPath();
      ctx.arc(300, 256, 180, 0, Math.PI, false);
      ctx.stroke();

      ctx.strokeStyle = '#FF5C00'; // Orange Swoosh
      ctx.beginPath();
      ctx.arc(724, 256, 180, Math.PI, 2 * Math.PI, false);
      ctx.stroke();

      // Gold stars/accents
      ctx.fillStyle = '#FFD700';
      const drawStar = (cx, cy, spikes, outerRadius, innerRadius) => {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius)
        for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius;
          y = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y)
          rot += step

          x = cx + Math.cos(rot) * innerRadius;
          y = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y)
          rot += step
        }
        ctx.lineTo(cx, cy - outerRadius)
        ctx.closePath();
        ctx.fill();
      }
      drawStar(512, 100, 5, 20, 10);
      drawStar(512, 412, 5, 20, 10);

      // 4. Draw Seam lines for the white hex panels
      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 2;
      // Latitudinal grid seams
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = ((90 - lat) / 180) * 512;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
      }
      // Longitudinal grid seams
      for (let lon = -180; lon < 180; lon += 60) {
        const x = ((lon + 180) / 360) * 1024;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }

      return canvas;
    };

    const ballCanvas = createBallTexture();
    const ballTexture = new THREE.CanvasTexture(ballCanvas);

    // --- 3D World Cup Ball Group ---
    const ballGroup = new THREE.Group();

    // Sphere Geometry & Material
    const ballGeo = new THREE.SphereGeometry(1.8, 64, 64);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTexture,
      roughness: 0.35,
      metalness: 0.1
    });

    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballGroup.add(ballMesh);
    scene.add(ballGroup);

    // --- Mouse Interaction State ---
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // --- Animation Loop ---
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse follow (easing)
      targetX += (mouseX - targetX) * 0.06;
      targetY += (mouseY - targetY) * 0.06;

      // Spin the ball and add mouse tilt to the rotation angles
      // Keeping position at (0, 0) prevents clipping/cutting the ball when cursor is moved.
      ballGroup.rotation.y = elapsedTime * 0.22 + targetX * 0.5;
      ballGroup.rotation.x = elapsedTime * 0.09 - targetY * 0.5;
      ballGroup.position.set(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // --- Handle Resize ---
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 200;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '220px',
        position: 'relative',
        cursor: 'grab'
      }}
    />
  );
}
