
'use client';

import * as React from 'react';
import BasicWorldMap, { type Continent } from 'react-basic-world-map';
import { cn } from '@/lib/utils';

interface WorldMapProps {
  onSelectContinent: (continentKey: string) => void;
  className?: string;
}

const WorldMap: React.FC<WorldMapProps> = ({ onSelectContinent, className }) => {
  const onClick = (continent: Continent) => {
    onSelectContinent(continent.key);
  };

  return (
    <div className={cn("relative w-full max-w-4xl mx-auto p-4", className)}>
       <BasicWorldMap
            primaryColor="hsl(var(--primary))"
            secondaryColor="hsl(var(--muted))"
            onClickMapContinent={onClick}
        />
    </div>
  );
};

export default WorldMap;
