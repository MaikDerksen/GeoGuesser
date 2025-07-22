"use client";

import { type FC } from 'react';
import { cn } from '@/lib/utils';
import { Navigation } from 'lucide-react';

interface CompassProps {
  heading: number;
  onGuess?: (angle: number) => void;
  gameState: 'idle' | 'permission' | 'loading_location' | 'playing' | 'results';
  guessAngle?: number | null;
  targetAngle?: number | null;
  className?: string;
}

const Arrow: FC<{ angle: number; color: string; label: string; offset: number }> = ({ angle, color, label, offset }) => (
  <div
    className="absolute w-full h-full transition-transform duration-500 ease-out"
    style={{ transform: `rotate(${angle}deg)` }}
  >
    <div className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center`} style={{ top: `${offset}px` }}>
      <Navigation className={cn("h-8 w-8", color)} />
      <span className={cn("text-xs font-bold", color)}>{label}</span>
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
        {/* Compass direction markers */}
        {['N', 'E', 'S', 'W'].map((dir, i) => (
            <div
            key={dir}
            className="absolute text-xl font-semibold text-muted-foreground transition-transform duration-500 ease-out"
            style={{
                transform: `rotate(${i * 90 - heading}deg) translateY(-${center * 0.85}px)`
            }}
            >
                <span style={{transform: `rotate(${-(i * 90 - heading)}deg)`, display: 'inline-block'}}>
                    {dir}
                </span>
            </div>
        ))}
      </div>

      <div className="absolute w-full h-full pointer-events-none">
        { (gameState === 'playing' || gameState === 'results') && <Arrow angle={northAngle} color="text-red-500" label="NORTH" offset={10} /> }
        
        {gameState === 'results' && (
          <>
            {targetAngle !== null && targetAngle !== undefined && (
              <Arrow angle={displayTargetAngle} color="text-accent" label="TARGET" offset={50} />
            )}
            {guessAngle !== null && guessAngle !== undefined && (
              <Arrow angle={displayGuessAngle} color="text-primary" label="GUESS" offset={90} />
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
