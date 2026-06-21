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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);

    // --- Lighting ---
    // Increased ambient light for highly vibrant, bright colors
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    // Strong primary directional light for crisp reflections
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(5, 5, 4);
    scene.add(dirLight);

    // Secondary fill light on the opposite side to balance shadows and maintain color accuracy
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.9);
    fillLight.position.set(-5, -5, 2);
    scene.add(fillLight);

    // --- Real World Cup Ball Texture Mapping ---
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 1. Initial State: Draw clean soccer base texture
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1024, 512);

    // Initial grid fallback
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 2;
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * 512;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }
    for (let lon = -180; lon < 180; lon += 60) {
      const x = ((lon + 180) / 360) * 1024;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }

    const ballTexture = new THREE.CanvasTexture(canvas);
    ballTexture.colorSpace = THREE.SRGBColorSpace;
    ballTexture.minFilter = THREE.LinearMipmapLinearFilter;
    ballTexture.magFilter = THREE.LinearFilter;

    // 2. Load and overlay the actual Adidas World Cup Match Ball texture
    const img = new Image();
    img.src = '/worldcup-ball.png';
    img.onload = () => {
      // Clear and draw background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1024, 512);

      // Create a temporary canvas to extract source pixels from the orthographic projection
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(img, 0, 0);

      const srcW = img.width;
      const srcH = img.height;
      const imgData = tempCtx.getImageData(0, 0, srcW, srcH);
      const srcPixels = imgData.data;

      const outData = ctx.createImageData(1024, 512);
      const dstPixels = outData.data;

      const srcCX = srcW / 2;
      const srcCY = srcH / 2;
      const radius = (Math.min(srcW, srcH) / 2) * 0.99; // Slightly scale to fit boundary nicely

      // Pixel-by-pixel mathematical mapping from orthographic sphere picture to equirectangular sphere UV
      for (let y = 0; y < 512; y++) {
        const theta = (y / 512) * Math.PI;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const yVal = cosTheta;

        const yOffset = y * 1024 * 4;

        for (let x = 0; x < 1024; x++) {
          const phi = (x / 1024) * 2 * Math.PI - Math.PI;

          // Convert spherical coordinates to 3D Cartesian coordinates (Z > 0 is front, Z < 0 is back - mirrored)
          const xVal = sinTheta * Math.sin(phi);
          const zVal = sinTheta * Math.cos(phi);

          // Project the 3D unit coordinates back onto the 2D image circle
          const projX = Math.round(srcCX + xVal * radius);
          const projY = Math.round(srcCY - yVal * radius);

          const dstIdx = yOffset + x * 4;

          if (projX >= 0 && projX < srcW && projY >= 0 && projY < srcH) {
            const srcIdx = (projY * srcW + projX) * 4;
            // Only draw if inside the circular ball boundary (alpha channel check)
            if (srcPixels[srcIdx + 3] > 10) {
              dstPixels[dstIdx] = srcPixels[srcIdx];
              dstPixels[dstIdx + 1] = srcPixels[srcIdx + 1];
              dstPixels[dstIdx + 2] = srcPixels[srcIdx + 2];
              dstPixels[dstIdx + 3] = 255;
              continue;
            }
          }

          // Default fallback color (clean white leather)
          dstPixels[dstIdx] = 255;
          dstPixels[dstIdx + 1] = 255;
          dstPixels[dstIdx + 2] = 255;
          dstPixels[dstIdx + 3] = 255;
        }
      }

      ctx.putImageData(outData, 0, 0);

      // Draw subtle real seams overlay on the canvas
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 2;
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = ((90 - lat) / 180) * 512;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 60) {
        const x = ((lon + 180) / 360) * 1024;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }

      ballTexture.needsUpdate = true;
    };

    // --- 3D World Cup Ball Group ---
    const ballGroup = new THREE.Group();

    // Sphere Geometry & Material
    const ballGeo = new THREE.SphereGeometry(1.8, 64, 64);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTexture,
      roughness: 0.18, // High glossy reflection
      metalness: 0.05
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
