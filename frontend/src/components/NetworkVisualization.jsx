import React, { useEffect, useRef, useState, useCallback } from 'react';

const NetworkVisualization = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef();
  const stateRef = useRef({ nodes: [], connections: [], packets: [], mouse: null, dragging: null, offset: { x: 0, y: 0 }, zoom: 1, hoveredNode: null });
  const [tooltip, setTooltip] = useState(null);

  const agentNames = [
    'MarketPulse AI', 'CodeReview Bot', 'DataOracle Pro', 'TradingBot Alpha',
    'NFT Monitor', 'CryptoAnalyst', 'DeFi Scanner', 'Sentiment Engine',
    'Yield Optimizer', 'Risk Analyzer', 'MEV Detector', 'Whale Tracker'
  ];

  const statusColors = {
    online: '#22c55e',
    busy: '#eab308',
    processing: '#3b82f6',
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const state = stateRef.current;
    let w, h;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create nodes
    const statuses = ['online', 'busy', 'processing'];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const spread = 0.6 + Math.random() * 0.3;
      state.nodes.push({
        id: i,
        x: w * 0.5 + Math.cos(angle) * w * spread * 0.35,
        y: h * 0.5 + Math.sin(angle) * h * spread * 0.35,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        baseRadius: 5 + Math.random() * 4,
        pulsePhase: Math.random() * Math.PI * 2,
        name: agentNames[i],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        rating: (4 + Math.random()).toFixed(1),
        txCount: Math.floor(Math.random() * 200) + 10,
      });
    }

    // Create connections
    for (let i = 0; i < 18; i++) {
      const a = Math.floor(Math.random() * state.nodes.length);
      let b = Math.floor(Math.random() * state.nodes.length);
      if (a === b) b = (b + 1) % state.nodes.length;
      // Avoid duplicate connections
      const exists = state.connections.some(c =>
        (c.from === state.nodes[a] && c.to === state.nodes[b]) ||
        (c.from === state.nodes[b] && c.to === state.nodes[a])
      );
      if (!exists) {
        state.connections.push({
          from: state.nodes[a],
          to: state.nodes[b],
          phase: Math.random() * Math.PI * 2,
          strength: 0.3 + Math.random() * 0.5,
          active: Math.random() > 0.5,
        });
      }
    }

    // Spawn data packets periodically
    const spawnPacket = () => {
      if (state.connections.length === 0) return;
      const conn = state.connections[Math.floor(Math.random() * state.connections.length)];
      const reverse = Math.random() > 0.5;
      state.packets.push({
        from: reverse ? conn.to : conn.from,
        to: reverse ? conn.from : conn.to,
        progress: 0,
        speed: 0.008 + Math.random() * 0.012,
        color: Math.random() > 0.5 ? '#3b82f6' : '#22c55e',
        size: 2 + Math.random() * 2,
        trail: [],
      });
    };

    const packetInterval = setInterval(spawnPacket, 800);
    // Spawn initial batch
    for (let i = 0; i < 5; i++) spawnPacket();

    // Random status changes
    const statusInterval = setInterval(() => {
      const node = state.nodes[Math.floor(Math.random() * state.nodes.length)];
      node.status = statuses[Math.floor(Math.random() * statuses.length)];
    }, 3000);

    // Random connection activation
    const activateInterval = setInterval(() => {
      const conn = state.connections[Math.floor(Math.random() * state.connections.length)];
      conn.active = true;
      setTimeout(() => { conn.active = false; }, 2000 + Math.random() * 3000);
    }, 1500);

    // Mouse/touch interaction
    const getCanvasPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left - state.offset.x) / state.zoom,
        y: (clientY - rect.top - state.offset.y) / state.zoom,
      };
    };

    const findNode = (pos) => {
      for (const node of state.nodes) {
        const dist = Math.hypot(node.x - pos.x, node.y - pos.y);
        if (dist < node.baseRadius + 12) return node;
      }
      return null;
    };

    const onMouseDown = (e) => {
      const pos = getCanvasPos(e);
      const node = findNode(pos);
      if (node) {
        state.dragging = node;
        node.vx = 0;
        node.vy = 0;
      }
    };

    const onMouseMove = (e) => {
      const pos = getCanvasPos(e);
      if (state.dragging) {
        state.dragging.x = pos.x;
        state.dragging.y = pos.y;
        state.dragging.vx = 0;
        state.dragging.vy = 0;
        setTooltip(null);
      } else {
        const node = findNode(pos);
        state.hoveredNode = node;
        if (node) {
          const rect = canvas.getBoundingClientRect();
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          setTooltip({
            x: clientX - rect.left,
            y: clientY - rect.top,
            node,
          });
          canvas.style.cursor = 'grab';
        } else {
          setTooltip(null);
          canvas.style.cursor = 'default';
        }
      }
    };

    const onMouseUp = () => {
      if (state.dragging) {
        state.dragging.vx = (Math.random() - 0.5) * 0.3;
        state.dragging.vy = (Math.random() - 0.5) * 0.3;
        state.dragging = null;
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      state.zoom = Math.max(0.5, Math.min(2.5, state.zoom * delta));
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', () => { state.dragging = null; state.hoveredNode = null; setTooltip(null); canvas.style.cursor = 'default'; });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onMouseDown, { passive: true });
    canvas.addEventListener('touchmove', onMouseMove, { passive: true });
    canvas.addEventListener('touchend', onMouseUp);

    let time = 0;

    const animate = () => {
      time += 0.016;
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.translate(state.offset.x, state.offset.y);
      ctx.scale(state.zoom, state.zoom);

      // Physics: attract nodes toward center gently
      state.nodes.forEach(node => {
        if (node === state.dragging) return;

        // Gentle center gravity
        const cx = w / (2 * state.zoom);
        const cy = h / (2 * state.zoom);
        node.vx += (cx - node.x) * 0.00005;
        node.vy += (cy - node.y) * 0.00005;

        // Repulsion between nodes
        state.nodes.forEach(other => {
          if (other === node) return;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 80) {
            const force = 0.05 / dist;
            node.vx += dx * force;
            node.vy += dy * force;
          }
        });

        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.98;
        node.vy *= 0.98;

        // Bounds
        const margin = 20;
        if (node.x < margin) { node.x = margin; node.vx *= -0.5; }
        if (node.x > w / state.zoom - margin) { node.x = w / state.zoom - margin; node.vx *= -0.5; }
        if (node.y < margin) { node.y = margin; node.vy *= -0.5; }
        if (node.y > h / state.zoom - margin) { node.y = h / state.zoom - margin; node.vy *= -0.5; }

        node.pulsePhase += 0.03;
      });

      // Draw connections
      state.connections.forEach(c => {
        const dist = Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y);
        if (dist > 350) return;

        c.phase += 0.015;
        const isHovered = state.hoveredNode && (c.from === state.hoveredNode || c.to === state.hoveredNode);
        const baseAlpha = c.active ? 0.25 : 0.06;
        const alpha = isHovered ? 0.5 : baseAlpha + Math.sin(c.phase) * 0.03;

        // Connection line
        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.lineWidth = isHovered ? 2 : (c.active ? 1.5 : 0.8);
        ctx.beginPath();
        ctx.moveTo(c.from.x, c.from.y);
        ctx.lineTo(c.to.x, c.to.y);
        ctx.stroke();

        // Active connection glow
        if (c.active) {
          ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.3})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(c.from.x, c.from.y);
          ctx.lineTo(c.to.x, c.to.y);
          ctx.stroke();
        }
      });

      // Draw and update packets
      state.packets = state.packets.filter(p => {
        p.progress += p.speed;
        if (p.progress >= 1) return false;

        const x = p.from.x + (p.to.x - p.from.x) * p.progress;
        const y = p.from.y + (p.to.y - p.from.y) * p.progress;

        // Trail
        p.trail.push({ x, y, age: 0 });
        if (p.trail.length > 12) p.trail.shift();

        // Draw trail
        p.trail.forEach((pt, idx) => {
          pt.age += 0.016;
          const trailAlpha = (1 - idx / p.trail.length) * 0.4;
          const trailSize = p.size * (1 - idx / p.trail.length) * 0.6;
          ctx.fillStyle = p.color.replace(')', `, ${trailAlpha})`).replace('rgb', 'rgba');
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, trailSize, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw packet
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        return true;
      });

      // Draw nodes
      state.nodes.forEach(node => {
        const isHovered = node === state.hoveredNode;
        const isDragging = node === state.dragging;
        const pulse = 1 + Math.sin(node.pulsePhase) * 0.15;
        const r = node.baseRadius * (isHovered ? 1.4 : 1) * pulse;

        // Outer ring for hovered/dragged
        if (isHovered || isDragging) {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 10, 0, Math.PI * 2);
          ctx.stroke();

          // Ripple effect
          const ripple = (time * 2 + node.id) % 3;
          ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 * (1 - ripple / 3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 10 + ripple * 10, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Outer glow
        const glowAlpha = isHovered ? 0.15 : 0.06;
        ctx.fillStyle = `rgba(59, 130, 246, ${glowAlpha})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 8, 0, Math.PI * 2);
        ctx.fill();

        // Main node body
        const gradient = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(1, 'rgba(200, 210, 230, 0.85)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = isHovered ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.2)';
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Status indicator dot
        const statusColor = statusColors[node.status] || '#3b82f6';
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(node.x + r * 0.7, node.y - r * 0.7, 3, 0, Math.PI * 2);
        ctx.fill();

        // Status dot border
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(node.x + r * 0.7, node.y - r * 0.7, 3, 0, Math.PI * 2);
        ctx.stroke();

        // Name label for hovered node
        if (isHovered) {
          ctx.font = '11px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(node.name, node.x, node.y + r + 18);
        }
      });

      ctx.restore();

      // Zoom indicator
      if (state.zoom !== 1) {
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(state.zoom * 100)}%`, w - 12, h - 8);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(packetInterval);
      clearInterval(statusInterval);
      clearInterval(activateInterval);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onMouseDown);
      canvas.removeEventListener('touchmove', onMouseMove);
      canvas.removeEventListener('touchend', onMouseUp);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="relative w-full h-80 rounded-xl overflow-hidden bg-primary/50">
      <canvas ref={canvasRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl"
          style={{
            left: Math.min(tooltip.x + 12, (canvasRef.current?.offsetWidth || 300) - 180),
            top: tooltip.y - 60,
          }}
        >
          <div className="text-sm font-medium text-white">{tooltip.node.name}</div>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColors[tooltip.node.status] }} />
              {tooltip.node.status}
            </span>
            <span>★ {tooltip.node.rating}</span>
            <span>{tooltip.node.txCount} txs</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-4 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />online</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />busy</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />processing</span>
      </div>

      {/* Interaction hint */}
      <div className="absolute top-3 right-3 text-[10px] text-zinc-600">
        drag nodes · scroll to zoom
      </div>
    </div>
  );
};

export default NetworkVisualization;
