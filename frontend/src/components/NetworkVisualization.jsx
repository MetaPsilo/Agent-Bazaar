import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const NetworkVisualization = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const nodes = [];
    const connections = [];

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create nodes (agents)
    const agentNames = ['MarketPulse AI', 'DataOracle', 'CodeReview Bot', 'CryptoAnalyst Pro', 'NFT Monitor'];
    const colors = ['#00d4ff', '#a855f7', '#00ff88', '#ec4899', '#f59e0b'];
    
    for (let i = 0; i < 8; i++) {
      nodes.push({
        id: i,
        x: Math.random() * (canvas.offsetWidth - 40) + 20,
        y: Math.random() * (canvas.offsetHeight - 40) + 20,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 8 + 6,
        color: colors[i % colors.length],
        name: agentNames[i % agentNames.length],
        activity: Math.random(),
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Create random connections
    for (let i = 0; i < 12; i++) {
      const node1 = nodes[Math.floor(Math.random() * nodes.length)];
      const node2 = nodes[Math.floor(Math.random() * nodes.length)];
      if (node1 !== node2) {
        connections.push({
          from: node1,
          to: node2,
          strength: Math.random() * 0.5 + 0.3,
          pulse: Math.random() * Math.PI * 2,
          active: Math.random() > 0.7,
        });
      }
    }

    let time = 0;

    const animate = () => {
      time += 0.016;
      
      // Clear canvas fully each frame for crisp rendering
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Update nodes
      nodes.forEach(node => {
        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off walls
        if (node.x <= node.radius || node.x >= canvas.offsetWidth - node.radius) {
          node.vx *= -0.8;
          node.x = Math.max(node.radius, Math.min(canvas.offsetWidth - node.radius, node.x));
        }
        if (node.y <= node.radius || node.y >= canvas.offsetHeight - node.radius) {
          node.vy *= -0.8;
          node.y = Math.max(node.radius, Math.min(canvas.offsetHeight - node.radius, node.y));
        }

        // Apply friction
        node.vx *= 0.995;
        node.vy *= 0.995;

        // Update pulse phase
        node.pulsePhase += 0.05;
      });

      // Draw connections
      connections.forEach(connection => {
        const { from, to } = connection;
        const distance = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
        
        if (distance < 200) {
          connection.pulse += 0.1;
          const alpha = connection.active ? 
            (Math.sin(connection.pulse) * 0.3 + 0.5) * connection.strength :
            connection.strength * 0.3;

          ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
          ctx.lineWidth = 1 + Math.sin(connection.pulse) * 0.5;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();

          // Draw data packets
          if (connection.active && Math.sin(connection.pulse) > 0.8) {
            const progress = (Math.sin(connection.pulse) - 0.8) / 0.2;
            const packetX = from.x + (to.x - from.x) * progress;
            const packetY = from.y + (to.y - from.y) * progress;
            
            ctx.fillStyle = connection.from.color;
            ctx.beginPath();
            ctx.arc(packetX, packetY, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        const pulseSize = 1 + Math.sin(node.pulsePhase) * 0.2;
        
        // Outer glow
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = node.color + '20';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Main node
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * pulseSize, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(node.x - node.radius * 0.3, node.y - node.radius * 0.3, node.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Activity indicator
        if (node.activity > 0.7) {
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Randomly activate connections
      if (Math.random() > 0.98) {
        const connection = connections[Math.floor(Math.random() * connections.length)];
        connection.active = true;
        setTimeout(() => {
          connection.active = false;
        }, 2000);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      className="relative w-full h-64 bg-gradient-to-br from-cyber-dark/20 to-transparent rounded-lg overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Legend */}
      <div className="absolute top-4 left-4 space-y-2">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-cyber-blue" />
          <span className="text-xs font-mono text-white/70">Active Agents</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-0.5 bg-cyber-blue/50" />
          <span className="text-xs font-mono text-white/70">Data Flow</span>
        </div>
      </div>

      {/* Stats Overlay */}
      <div className="absolute bottom-4 right-4 glass p-3 rounded-lg">
        <div className="text-xs font-mono space-y-1">
          <div className="flex justify-between space-x-4">
            <span className="text-white/60">Nodes:</span>
            <span className="text-cyber-blue">8</span>
          </div>
          <div className="flex justify-between space-x-4">
            <span className="text-white/60">Connections:</span>
            <span className="text-cyber-green">12</span>
          </div>
          <div className="flex justify-between space-x-4">
            <span className="text-white/60">Latency:</span>
            <span className="text-cyber-purple">~23ms</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default NetworkVisualization;