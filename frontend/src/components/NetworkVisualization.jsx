import React, { useEffect, useRef } from 'react';

const NetworkVisualization = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const nodes = [];
    const connections = [];

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    for (let i = 0; i < 10; i++) {
      nodes.push({
        x: Math.random() * (canvas.offsetWidth - 40) + 20,
        y: Math.random() * (canvas.offsetHeight - 40) + 20,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 4 + 3,
      });
    }

    for (let i = 0; i < 14; i++) {
      const a = Math.floor(Math.random() * nodes.length);
      let b = Math.floor(Math.random() * nodes.length);
      if (a === b) b = (b + 1) % nodes.length;
      connections.push({ from: nodes[a], to: nodes[b], phase: Math.random() * Math.PI * 2 });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x <= node.radius || node.x >= canvas.offsetWidth - node.radius) node.vx *= -1;
        if (node.y <= node.radius || node.y >= canvas.offsetHeight - node.radius) node.vy *= -1;
        node.x = Math.max(node.radius, Math.min(canvas.offsetWidth - node.radius, node.x));
        node.y = Math.max(node.radius, Math.min(canvas.offsetHeight - node.radius, node.y));
        node.vx *= 0.999;
        node.vy *= 0.999;
      });

      // Connections
      connections.forEach(c => {
        const dist = Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y);
        if (dist < 250) {
          c.phase += 0.02;
          const alpha = 0.08 + Math.sin(c.phase) * 0.04;
          ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(c.from.x, c.from.y);
          ctx.lineTo(c.to.x, c.to.y);
          ctx.stroke();
        }
      });

      // Nodes
      nodes.forEach(node => {
        // Soft shadow
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
        ctx.fill();

        // Node
        ctx.fillStyle = 'rgba(250, 250, 250, 0.9)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden bg-primary/50">
      <canvas ref={canvasRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default NetworkVisualization;
