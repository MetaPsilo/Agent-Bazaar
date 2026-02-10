import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

const AnimatedCounter = ({ value, duration = 1500 }) => {
  const [displayValue, setDisplayValue] = useState('0');
  const rafRef = useRef(null);

  useEffect(() => {
    // Parse target number from value (handles strings like "$1.2M")
    let prefix = '';
    let suffix = '';
    let targetNum = 0;
    let decimals = 0;

    if (typeof value === 'string') {
      const match = value.match(/^([^\d]*)([\d.]+)(.*)$/);
      if (match) {
        prefix = match[1];
        targetNum = parseFloat(match[2]);
        suffix = match[3];
        decimals = match[2].includes('.') ? match[2].split('.')[1].length : 0;
      } else {
        setDisplayValue(value);
        return;
      }
    } else {
      targetNum = value || 0;
    }

    const startTime = performance.now();
    const startValue = 0;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (targetNum - startValue) * eased;

      if (typeof value === 'string') {
        setDisplayValue(`${prefix}${current.toFixed(decimals)}${suffix}`);
      } else {
        setDisplayValue(Math.floor(current).toLocaleString());
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <motion.span
      className="tabular-nums"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {displayValue}
    </motion.span>
  );
};

export default AnimatedCounter;
