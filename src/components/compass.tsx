
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

const Needle: FC<{ color: string; length: number; label: string }> = ({ color, length, label }) => (
    <div className="relative w-2 h-full">
      <div
        className="absolute bottom-1/2 left-0 w-full origin-bottom"
        style={{ height: length }}
      >
        <div className={cn("absolute bottom-0 left-0 w-full h-full bg-current", color)} style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)'}}/>
      </div>
      <div className={cn("absolute left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap px-2 py-1 rounded-full text-white", color.replace("text-", "bg-"))} style={{ top: `calc(50% - ${length}px - 2rem)` }}>
        {label}
      </div>
    </div>
  );
  

const Arrow: FC<{ angle: number; color: string; label: string; length: number; }> = ({ angle, color, label, length }) => {
    const arrowRef = useRef<HTMLDivElement>(null);
    const prevAngleRef = useRef<number>(angle);

    useEffect(() => {
        if (arrowRef.current) {
            let currentAngle = prevAngleRef.current;
            let targetAngle = angle;

            const diff = targetAngle - currentAngle;
            if (Math.abs(diff) > 180) {
                if (diff > 0) {
                    currentAngle += 360;
                } else {
                    currentAngle -= 360;
                }
            }

            arrowRef.current.style.transition = 'none';
            arrowRef.current.style.transform = `rotate(${currentAngle}deg)`;
            
            arrowRef.current.getBoundingClientRect();

            arrowRef.current.style.transition = 'transform 0.5s ease-out';
            arrowRef.current.style.transform = `rotate(${targetAngle}deg)`;

            prevAngleRef.current = angle;
        }
    }, [angle]);

    return (
        <div
            ref={arrowRef}
            className="absolute w-full h-full pointer-events-none"
            style={{ transform: `rotate(${angle}deg)` }}
        >
            <div className={cn("absolute w-full h-full flex justify-center items-start", color)}>
                <Needle color={color} length={length} label={label}/>
            </div>
        </div>
    );
};

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
      
      if (Math.abs(diff) > 180) {
        if (diff > 0) {
          currentHeading += 360;
        } else {
          currentHeading -= 360;
        }
      }
      
      roseRef.current.style.transition = 'none';
      roseRef.current.style.transform = `rotate(${-currentHeading}deg)`;
      
      roseRef.current.getBoundingClientRect(); 

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
        { (gameState === 'playing' || gameState === 'results') && <Arrow angle={northAngle} color="text-red-500" label="NORTH" length={120} /> }
        
        {gameState === 'results' && (
          <>
            {targetAngle !== null && targetAngle !== undefined && (
              <Arrow angle={displayTargetAngle} color="text-accent" label="TARGET" length={120} />
            )}
            {guessAngle !== null && guessAngle !== undefined && (
              <Arrow angle={displayGuessAngle} color="text-primary" label="GUESS" length={120} />
            )}
          </>
        )}
      </div>
      
       <div className="absolute w-4 h-4 bg-foreground rounded-full" />

       {/* Fixed pointer at top */}
       <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 pointer-events-none">
        <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[20px] border-l-transparent border-r-transparent border-b-foreground" />
      </div>
    </div>
  );
};

export default Compass;
