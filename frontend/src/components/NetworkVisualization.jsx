import React, { useEffect, useRef, useState, useCallback } from 'react';

const NetworkVisualization = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef();
  const stateRef = useRef({
    nodes: [], connections: [], packets: [],
    dragging: null, panning: false, panStart: null,
    offset: { x: 0, y: 0 }, zoom: 1,
    hoveredNode: null, selectedNode: null,
    ripples: [],
  });
  const [tooltip, setTooltip] = useState(null);
  const [selected, setSelected] = useState(null);
  const [realAgents, setRealAgents] = useState(null);

  useEffect(() => {
    fetch('/agents')
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.agents || []);
        setRealAgents(list);
      })
      .catch(() => setRealAgents([]));
  }, []);

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

    // Reset nodes when agents change
    state.nodes = [];
    state.connections = [];
    state.packets = [];

    // Use real agents if available, otherwise skip
    if (realAgents !== null && realAgents.length === 0) {
      // No agents — don't draw anything
      ctx.clearRect(0, 0, w, h);
      return () => { window.removeEventListener('resize', resizeCanvas); };
    }

    const agentNames = realAgents && realAgents.length > 0
      ? realAgents.map(a => a.name)
      : ['Agent 1', 'Agent 2', 'Agent 3'];
    const nodeCount = agentNames.length;

    // Create nodes in a nice spread
    const statuses = ['online', 'busy', 'processing'];
    if (state.nodes.length === 0) {
      for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2;
        const spread = 0.55 + Math.random() * 0.35;
        state.nodes.push({
          id: i,
          x: w * 0.5 + Math.cos(angle) * w * spread * 0.35,
          y: h * 0.5 + Math.sin(angle) * h * spread * 0.35,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          baseRadius: 6 + Math.random() * 4,
          pulsePhase: Math.random() * Math.PI * 2,
          name: agentNames[i] || `Agent ${i}`,
          type: realAgents?.[i]?.description?.slice(0, 20) || 'Agent',
          status: statuses[Math.floor(Math.random() * statuses.length)],
          rating: realAgents?.[i]?.avg_rating?.toFixed(1) || '0.0',
          txCount: realAgents?.[i]?.total_ratings || 0,
          earnings: ((realAgents?.[i]?.total_volume || 0) / 1000000).toFixed(0),
        });
      }

      // Create connections with better distribution
      const connected = new Set();
      // Ensure every node has at least one connection
      for (let i = 0; i < state.nodes.length; i++) {
        let target = (i + 1 + Math.floor(Math.random() * 3)) % state.nodes.length;
        const key = Math.min(i, target) + '-' + Math.max(i, target);
        if (!connected.has(key)) {
          connected.add(key);
          state.connections.push({
            from: state.nodes[i], to: state.nodes[target],
            phase: Math.random() * Math.PI * 2,
            strength: 0.3 + Math.random() * 0.5,
            active: Math.random() > 0.4,
          });
        }
      }
      // Add extra connections for density
      for (let i = 0; i < 8; i++) {
        const a = Math.floor(Math.random() * state.nodes.length);
        let b = Math.floor(Math.random() * state.nodes.length);
        if (a === b) b = (b + 1) % state.nodes.length;
        const key = Math.min(a, b) + '-' + Math.max(a, b);
        if (!connected.has(key)) {
          connected.add(key);
          state.connections.push({
            from: state.nodes[a], to: state.nodes[b],
            phase: Math.random() * Math.PI * 2,
            strength: 0.3 + Math.random() * 0.5,
            active: Math.random() > 0.5,
          });
        }
      }
    }

    // Spawn data packets
    const spawnPacket = () => {
      if (state.connections.length === 0) return;
      const conn = state.connections[Math.floor(Math.random() * state.connections.length)];
      const reverse = Math.random() > 0.5;
      state.packets.push({
        from: reverse ? conn.to : conn.from,
        to: reverse ? conn.from : conn.to,
        progress: 0,
        speed: 0.006 + Math.random() * 0.014,
        color: Math.random() > 0.5 ? '#3b82f6' : '#22c55e',
        size: 2 + Math.random() * 2,
        trail: [],
      });
    };

    const packetInterval = setInterval(spawnPacket, 600);
    for (let i = 0; i < 6; i++) spawnPacket();

    const statusInterval = setInterval(() => {
      const node = state.nodes[Math.floor(Math.random() * state.nodes.length)];
      node.status = statuses[Math.floor(Math.random() * statuses.length)];
    }, 3000);

    const activateInterval = setInterval(() => {
      const conn = state.connections[Math.floor(Math.random() * state.connections.length)];
      conn.active = true;
      setTimeout(() => { conn.active = false; }, 2000 + Math.random() * 3000);
    }, 1200);

    // Mouse helpers
    const getCanvasPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left - state.offset.x) / state.zoom,
        y: (clientY - rect.top - state.offset.y) / state.zoom,
        screenX: clientX - rect.left,
        screenY: clientY - rect.top,
      };
    };

    const findNode = (pos) => {
      for (const node of state.nodes) {
        const dist = Math.hypot(node.x - pos.x, node.y - pos.y);
        if (dist < node.baseRadius + 14) return node;
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
        canvas.style.cursor = 'grabbing';
      } else {
        // Start panning
        state.panning = true;
        state.panStart = { x: pos.screenX - state.offset.x, y: pos.screenY - state.offset.y };
        canvas.style.cursor = 'move';
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
      } else if (state.panning && state.panStart) {
        state.offset.x = pos.screenX - state.panStart.x;
        state.offset.y = pos.screenY - state.panStart.y;
      } else {
        const node = findNode(pos);
        state.hoveredNode = node;
        if (node) {
          setTooltip({ x: pos.screenX, y: pos.screenY, node });
          canvas.style.cursor = 'grab';
        } else {
          setTooltip(null);
          canvas.style.cursor = 'default';
        }
      }
    };

    const onMouseUp = (e) => {
      if (state.dragging) {
        // If barely moved, treat as click → select
        state.dragging.vx = (Math.random() - 0.5) * 0.2;
        state.dragging.vy = (Math.random() - 0.5) * 0.2;
        state.dragging = null;
      }
      if (state.panning) {
        state.panning = false;
        state.panStart = null;
      }
      canvas.style.cursor = 'default';
    };

    const onClick = (e) => {
      const pos = getCanvasPos(e);
      const node = findNode(pos);
      if (node) {
        state.selectedNode = node;
        setSelected(node);
        // Spawn a burst of ripples on click
        state.ripples.push({ x: node.x, y: node.y, radius: 0, maxRadius: 60, alpha: 0.6 });
        // Spawn packets from this node
        state.connections.forEach(c => {
          if (c.from === node || c.to === node) {
            state.packets.push({
              from: node,
              to: c.from === node ? c.to : c.from,
              progress: 0,
              speed: 0.015 + Math.random() * 0.01,
              color: '#f59e0b',
              size: 3,
              trail: [],
            });
          }
        });
      } else {
        state.selectedNode = null;
        setSelected(null);
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldZoom = state.zoom;
      const delta = e.deltaY > 0 ? 0.93 : 1.07;
      state.zoom = Math.max(0.4, Math.min(3, state.zoom * delta));

      // Zoom toward cursor
      state.offset.x = mouseX - (mouseX - state.offset.x) * (state.zoom / oldZoom);
      state.offset.y = mouseY - (mouseY - state.offset.y) * (state.zoom / oldZoom);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mouseleave', () => {
      state.dragging = null;
      state.panning = false;
      state.hoveredNode = null;
      setTooltip(null);
      canvas.style.cursor = 'default';
    });
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

      // Physics
      state.nodes.forEach(node => {
        if (node === state.dragging) return;

        const cx = w / 2;
        const cy = h / 2;
        node.vx += (cx - node.x) * 0.00004;
        node.vy += (cy - node.y) * 0.00004;

        // Connection spring forces (attract connected nodes)
        state.connections.forEach(c => {
          let other = null;
          if (c.from === node) other = c.to;
          else if (c.to === node) other = c.from;
          if (!other) return;
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.hypot(dx, dy) || 1;
          const idealDist = 120;
          const force = (dist - idealDist) * 0.0003;
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        });

        // Repulsion
        state.nodes.forEach(other => {
          if (other === node) return;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 90) {
            const force = 0.06 / dist;
            node.vx += dx * force;
            node.vy += dy * force;
          }
        });

        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.97;
        node.vy *= 0.97;

        const margin = 30;
        if (node.x < margin) { node.x = margin; node.vx *= -0.5; }
        if (node.x > w - margin) { node.x = w - margin; node.vx *= -0.5; }
        if (node.y < margin) { node.y = margin; node.vy *= -0.5; }
        if (node.y > h - margin) { node.y = h - margin; node.vy *= -0.5; }

        node.pulsePhase += 0.025;
      });

      // Draw connections
      state.connections.forEach(c => {
        const dist = Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y);
        if (dist > 400) return;

        c.phase += 0.015;
        const isHovered = state.hoveredNode && (c.from === state.hoveredNode || c.to === state.hoveredNode);
        const isSelected = state.selectedNode && (c.from === state.selectedNode || c.to === state.selectedNode);
        const highlight = isSelected || isHovered;
        const baseAlpha = c.active ? 0.25 : 0.07;
        const alpha = highlight ? 0.55 : baseAlpha + Math.sin(c.phase) * 0.03;

        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.lineWidth = highlight ? 2.5 : (c.active ? 1.5 : 0.8);
        ctx.beginPath();
        ctx.moveTo(c.from.x, c.from.y);
        ctx.lineTo(c.to.x, c.to.y);
        ctx.stroke();

        if (c.active || highlight) {
          ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.25})`;
          ctx.lineWidth = highlight ? 6 : 4;
          ctx.beginPath();
          ctx.moveTo(c.from.x, c.from.y);
          ctx.lineTo(c.to.x, c.to.y);
          ctx.stroke();
        }

        // Animated dashes on selected connections
        if (isSelected) {
          ctx.save();
          ctx.setLineDash([4, 8]);
          ctx.lineDashOffset = -time * 30;
          ctx.strokeStyle = `rgba(245, 158, 11, 0.4)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(c.from.x, c.from.y);
          ctx.lineTo(c.to.x, c.to.y);
          ctx.stroke();
          ctx.restore();
        }
      });

      // Draw ripples
      state.ripples = state.ripples.filter(r => {
        r.radius += 1.5;
        r.alpha -= 0.012;
        if (r.alpha <= 0) return false;
        ctx.strokeStyle = `rgba(245, 158, 11, ${r.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        return true;
      });

      // Draw packets
      state.packets = state.packets.filter(p => {
        p.progress += p.speed;
        if (p.progress >= 1) {
          // Arrival ripple
          state.ripples.push({ x: p.to.x, y: p.to.y, radius: 0, maxRadius: 25, alpha: 0.3 });
          return false;
        }

        const x = p.from.x + (p.to.x - p.from.x) * p.progress;
        const y = p.from.y + (p.to.y - p.from.y) * p.progress;

        p.trail.push({ x, y });
        if (p.trail.length > 10) p.trail.shift();

        p.trail.forEach((pt, idx) => {
          const trailAlpha = (idx / p.trail.length) * 0.35;
          const trailSize = p.size * (idx / p.trail.length) * 0.7;
          ctx.fillStyle = p.color.replace(')', `, ${trailAlpha})`).replace('rgb', 'rgba');
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, trailSize, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        return true;
      });

      // Draw nodes
      state.nodes.forEach(node => {
        const isHovered = node === state.hoveredNode;
        const isSelected = node === state.selectedNode;
        const isDragging = node === state.dragging;
        const highlight = isHovered || isSelected || isDragging;
        const pulse = 1 + Math.sin(node.pulsePhase) * 0.12;
        const r = node.baseRadius * (highlight ? 1.4 : 1) * pulse;

        // Selection ring
        if (isSelected) {
          const selPulse = Math.sin(time * 3) * 0.15 + 0.85;
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.5 * selPulse})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 12, 0, Math.PI * 2);
          ctx.stroke();

          // Orbiting dot
          const orbitAngle = time * 2 + node.id;
          const ox = node.x + Math.cos(orbitAngle) * (r + 12);
          const oy = node.y + Math.sin(orbitAngle) * (r + 12);
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Hover ring + ripple
        if (isHovered && !isSelected) {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 10, 0, Math.PI * 2);
          ctx.stroke();

          const ripple = (time * 2 + node.id) % 2.5;
          ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 * (1 - ripple / 2.5)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 10 + ripple * 12, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Outer glow
        const glowAlpha = highlight ? 0.15 : 0.05;
        ctx.fillStyle = isSelected
          ? `rgba(245, 158, 11, ${glowAlpha})`
          : `rgba(59, 130, 246, ${glowAlpha})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 8, 0, Math.PI * 2);
        ctx.fill();

        // Node body
        const gradient = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(1, 'rgba(200, 210, 230, 0.85)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = isSelected
          ? 'rgba(245, 158, 11, 0.6)'
          : isHovered ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.2)';
        ctx.lineWidth = highlight ? 2 : 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Status dot
        const statusColor = statusColors[node.status] || '#3b82f6';
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(node.x + r * 0.7, node.y - r * 0.7, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(node.x + r * 0.7, node.y - r * 0.7, 3, 0, Math.PI * 2);
        ctx.stroke();

        // Name label
        if (highlight) {
          ctx.font = '11px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(node.name, node.x, node.y + r + 18);
        }
      });

      ctx.restore();

      // Zoom indicator
      if (Math.abs(state.zoom - 1) > 0.05) {
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
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onMouseDown);
      canvas.removeEventListener('touchmove', onMouseMove);
      canvas.removeEventListener('touchend', onMouseUp);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [realAgents]);

  return (
    <div className="relative w-full h-80 rounded-xl overflow-hidden bg-primary/50">
      {realAgents !== null && realAgents.length === 0 ? (
        <div className="flex items-center justify-center h-full text-text-tertiary">
          <div className="text-center">
            <div className="text-3xl mb-3 opacity-30">🌐</div>
            <p className="text-sm">Agent network visualization</p>
            <p className="text-xs mt-1 opacity-60">Nodes appear as agents register</p>
          </div>
        </div>
      ) : null}
      <canvas ref={canvasRef} className="w-full h-full" style={{ width: '100%', height: '100%', display: realAgents?.length === 0 ? 'none' : 'block' }} />

      {/* Hover tooltip */}
      {tooltip && !selected && (
        <div
          className="absolute pointer-events-none z-10 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl"
          style={{
            left: Math.min(tooltip.x + 12, (canvasRef.current?.offsetWidth || 300) - 200),
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

      {/* Selected node panel */}
      {selected && (
        <div className="absolute top-3 left-3 z-10 bg-zinc-900/95 border border-zinc-700 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm max-w-[220px]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-white">{selected.name}</div>
            <button
              onClick={() => { stateRef.current.selectedNode = null; setSelected(null); }}
              className="text-zinc-500 hover:text-white text-xs ml-2"
            >✕</button>
          </div>
          <div className="space-y-1.5 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span>Type</span>
              <span className="text-zinc-200">{selected.type}</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColors[selected.status] }} />
                <span className="text-zinc-200">{selected.status}</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span>Rating</span>
              <span className="text-zinc-200">★ {selected.rating}</span>
            </div>
            <div className="flex justify-between">
              <span>Transactions</span>
              <span className="text-zinc-200">{selected.txCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Earnings</span>
              <span className="text-zinc-200">${selected.earnings} USDC</span>
            </div>
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
        click nodes · drag to move · scroll to zoom
      </div>
    </div>
  );
};

export default NetworkVisualization;
