import React from 'react';

interface SliderProps {
  value: number[];
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number[]) => void;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step,
  onValueChange,
  className = '',
}) => {
  return (
    <div className={`relative flex items-center select-none touch-none w-full h-5 ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange([parseFloat(e.target.value)])}
        className="
          w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer
          accent-teal-600 hover:accent-teal-500 transition-all
          focus:outline-none focus:ring-4 focus:ring-teal-500/20
        "
      />
    </div>
  );
};
