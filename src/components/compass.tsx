"use client";

import { type FC, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CompassProps {
  heading: number;
  onGuess?: (angle: number) => void;
  gameState: 'idle' | 'permission' | 'loading_location' | 'playing' | 'results';
  guessAngle?: number | null;
  targetAngle?: number | null;
  className?: string;
}

const Needle: FC<{ color: string; }> = ({ color }) => (
    <svg width="12" height="140" viewBox="0 0 12 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
        <path d="M6 0L11.7735 15H0.226497L6 0Z" className={cn("fill-current", color)} />
        <path d="M5 14L5 139" className={cn("stroke-current", color)} strokeWidth="2"/>
        <path d="M7 14L7 139" className={cn("stroke-current", color)} strokeWidth="2"/>
    </svg>
);


const Arrow: FC<{ angle: number; color: string; label: string; length: number }> = ({ angle, color, label, length }) => (
  <div
    className="absolute w-full h-full transition-transform duration-500 ease-out origin-center pointer-events-none"
    style={{ transform: `rotate(${angle}deg)` }}
  >
    <div
      className={cn("absolute left-1/2 -translate-x-1/2 bottom-1/2 origin-bottom flex flex-col items-center", color)}
      style={{ height: `${length}px` }}
    >
      <span className={cn("text-xs font-bold bg-background/50 backdrop-blur-sm rounded-sm px-1 mb-1", color)}>{label}</span>
      <div className="w-12 h-full flex justify-center items-end">
          <Needle color={color} />
      </div>
    </div>
  </div>
);

const Compass: FC<CompassProps> = ({
  heading,
  onGuess,
  gameState,
  guessAngle,
  targetAngle,
  className,
}) => {
  const compassSize = 320;
  const center = compassSize / 2;
  const roseRef = useRef<HTMLDivElement>(null);
  const prevHeadingRef = useRef<number>(heading);

  useEffect(() => {
    if (roseRef.current) {
      let currentHeading = prevHeadingRef.current;
      let targetHeading = heading;
      
      const diff = targetHeading - currentHeading;
      
      // If we've jumped more than 180 degrees, it's shorter to go the other way
      if (Math.abs(diff) > 180) {
        if (diff > 0) {
          currentHeading += 360;
        } else {
          currentHeading -= 360;
        }
      }
      
      // Use a temporary non-animated state to bridge the gap
      roseRef.current.style.transition = 'none';
      roseRef.current.style.transform = `rotate(${-currentHeading}deg)`;
      
      // Force a reflow
      roseRef.current.getBoundingClientRect(); 

      // Apply the animation to the target
      roseRef.current.style.transition = 'transform 0.5s ease-out';
      roseRef.current.style.transform = `rotate(${-targetHeading}deg)`;
      
      prevHeadingRef.current = heading;
    }
  }, [heading]);

  const handleCompassClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onGuess || gameState !== 'playing') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - center;
    const y = e.clientY - rect.top - center;

    let clickAngle = Math.atan2(y, x) * (180 / Math.PI);
    clickAngle = (clickAngle + 90 + 360) % 360; // 0 is up

    const bearing = (clickAngle + heading) % 360;
    onGuess(bearing);
  };

  const northAngle = -heading;
  const displayGuessAngle = guessAngle !== null && guessAngle !== undefined ? guessAngle - heading : 0;
  const displayTargetAngle = targetAngle !== null && targetAngle !== undefined ? targetAngle - heading : 0;

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: compassSize, height: compassSize }}>
      <div
        className="w-full h-full rounded-full bg-card shadow-2xl flex items-center justify-center border-4 border-secondary"
        onClick={handleCompassClick}
        style={{ cursor: gameState === 'playing' ? 'pointer' : 'default' }}
      >
        <div 
          ref={roseRef}
          className="w-full h-full"
          style={{ transform: `rotate(${-heading}deg)`}}
        >
            {/* Compass direction markers */}
            {['N', 'E', 'S', 'W'].map((dir, i) => (
                <div
                key={dir}
                className="absolute w-full h-full text-xl font-semibold text-muted-foreground"
                style={{
                    transform: `rotate(${i * 90}deg)`
                }}
                >
                    <span style={{
                        position: 'absolute',
                        top: `${center * 0.15}px`,
                        left: '50%',
                        transform: 'translateX(-50%)'
                    }}>
                        {dir}
                    </span>
                </div>
            ))}
        </div>
      </div>

      <div className="absolute w-full h-full pointer-events-none">
        { (gameState === 'playing' || gameState === 'results') && <Arrow angle={northAngle} color="text-red-500" label="NORTH" length={130} /> }
        
        {gameState === 'results' && (
          <>
            {targetAngle !== null && targetAngle !== undefined && (
              <Arrow angle={displayTargetAngle} color="text-accent" label="TARGET" length={110} />
            )}
            {guessAngle !== null && guessAngle !== undefined && (
              <Arrow angle={displayGuessAngle} color="text-primary" label="GUESS" length={90} />
            )}
          </>
        )}
      </div>

       {/* Fixed pointer at top */}
       <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 pointer-events-none">
        <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[20px] border-l-transparent border-r-transparent border-b-foreground" />
      </div>
    </div>
  );
};

export default Compass;
