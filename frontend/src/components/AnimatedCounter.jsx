import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

const AnimatedCounter = ({ value, duration = 1000, format = 'number' }) => {
  const [prevValue, setPrevValue] = useState(0);
  const [displayValue, setDisplayValue] = useState(value);

  // Handle string values (like "$1.2M")
  const numericValue = React.useMemo(() => {
    if (typeof value === 'string') {
      // Extract number from string like "$1.2M" -> 1.2
      const matches = value.match(/[\d.]+/);
      return matches ? parseFloat(matches[0]) : 0;
    }
    return value || 0;
  }, [value]);

  const springValue = useSpring(prevValue, {
    stiffness: 100,
    damping: 30,
  });

  const animatedValue = useTransform(springValue, (latest) => {
    if (typeof value === 'string') {
      // For string values, interpolate the number part and reconstruct
      const prefix = value.match(/^[^\d]*/)?.[0] || '';
      const suffix = value.match(/[^\d]*$/)?.[0] || '';
      const numPart = latest.toFixed(value.includes('.') ? 1 : 0);
      return `${prefix}${numPart}${suffix}`;
    }
    
    // For pure numbers
    return Math.floor(latest).toLocaleString();
  });

  useEffect(() => {
    setPrevValue(springValue.get());
    springValue.set(numericValue);
  }, [numericValue, springValue]);

  // Subscribe to spring value changes
  useEffect(() => {
    return animatedValue.onChange(setDisplayValue);
  }, [animatedValue]);

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