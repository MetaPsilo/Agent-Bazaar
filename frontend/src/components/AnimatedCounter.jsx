import React, { useEffect, useState, useRef } from 'react';

const AnimatedCounter = ({ value, duration = 1200 }) => {
  const [display, setDisplay] = useState('0');
  const rafRef = useRef(null);

  useEffect(() => {
    let prefix = '', suffix = '', target = 0, decimals = 0;

    if (typeof value === 'string') {
      const match = value.match(/^([^\d]*)([\d.]+)(.*)$/);
      if (match) {
        prefix = match[1];
        target = parseFloat(match[2]);
        suffix = match[3];
        decimals = match[2].includes('.') ? match[2].split('.')[1].length : 0;
      } else {
        setDisplay(value);
        return;
      }
    } else {
      target = value || 0;
    }

    const start = performance.now();

    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = target * eased;

      if (typeof value === 'string') {
        setDisplay(`${prefix}${current.toFixed(decimals)}${suffix}`);
      } else {
        setDisplay(Math.floor(current).toLocaleString());
      }

      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <span className="tabular-nums">{display}</span>;
};

export default AnimatedCounter;
