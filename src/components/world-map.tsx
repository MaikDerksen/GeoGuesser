
'use client';

import * as React from 'react';
import BasicWorldMap, { type Continent } from 'react-basic-world-map';
import { cn } from '@/lib/utils';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface WorldMapProps {
  onSelectContinent: (continentKey: string) => void;
  className?: string;
}

const WorldMap: React.FC<WorldMapProps> = ({ onSelectContinent, className }) => {
  const onClick = (continent: Continent) => {
    onSelectContinent(continent.key);
  };

  return (
    <div className={cn("w-full h-full cursor-move border rounded-lg overflow-hidden", className)}>
       <TransformWrapper
          initialScale={1}
          minScale={0.8}
          maxScale={5}
          centerOnInit
       >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%'}}
          contentStyle={{ width: '100%', height: '100%'}}
        >
          <BasicWorldMap
              primaryColor="hsl(var(--primary))"
              secondaryColor="hsl(var(--muted))"
              onClickMapContinent={onClick}
          />
        </TransformComponent>
       </TransformWrapper>
    </div>
  );
};

export default WorldMap;
