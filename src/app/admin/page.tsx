
"use client";

import { useState, useEffect, useCallback, FormEvent, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Edit, Trash2, Users, Search } from 'lucide-react';
import {
  getUserGameModes,
  addGameMode,
  updateGameMode,
  deleteGameMode,
  addLocationToGameMode,
  updateLocationInGameMode,
  deleteLocationFromGameMode,
  type GameMode,
  type Location
} from '@/lib/game-data';
import { getCoordinatesForAddress } from '@/ai/flows/get-coordinates-for-address';
import { getAddressPredictions, type GetAddressPredictionsOutput } from '@/ai/flows/get-address-predictions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


const LocationForm = ({
  gameModeId,
  location,
  onSave,
  onClose,
}: {
  gameModeId: string;
  location?: Location & { index: number };
  onSave: () => void;
  onClose: () => void;
}) => {
  const [name, setName] = useState(location?.name || '');
  const [coordinates, setCoordinates] = useState<Location['coordinates'] | null>(location?.coordinates || null);
  
  const [searchQuery, setSearchQuery] = useState(location?.name || '');
  const [predictions, setPredictions] = useState<GetAddressPredictionsOutput>([]);
  const [isPredictionsOpen, setIsPredictionsOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = async (value: string) => {
    setSearchQuery(value);
    if (value.length > 2) {
        if (!isPredictionsOpen) setIsPredictionsOpen(true);
        setLoading(true);
        try {
            const preds = await getAddressPredictions(value);
            setPredictions(preds);
        } catch(err: any) {
             toast({ title: 'Autocomplete Error', description: `Failed to get suggestions: ${err.message}`, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    } else {
        setPredictions([]);
        if(isPredictionsOpen) setIsPredictionsOpen(false);
    }
  };

  const handlePredictionSelect = async (prediction: GetAddressPredictionsOutput[0]) => {
      setSearchQuery(prediction.description);
      setName(prediction.description.split(',')[0]);
      setPredictions([]);
      setIsPredictionsOpen(false);
      setLoading(true);
      try {
          const coords = await getCoordinatesForAddress({ placeId: prediction.place_id });
          if (coords) {
              setCoordinates(coords);
          } else {
               toast({ title: 'Not Found', description: `Could not find coordinates for "${prediction.description}"`, variant: 'destructive' });
               setCoordinates(null);
          }
      } catch (err: any) {
           toast({ title: 'Error', description: `Failed to search: ${err.message}`, variant: 'destructive' });
           setCoordinates(null);
      } finally {
          setLoading(false);
      }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !coordinates) {
        toast({ title: 'Missing Information', description: 'Please select a valid location from the search.', variant: 'destructive'});
        return;
    }
    setLoading(true);

    const newLocation: Location = { name, coordinates };

    try {
      if (location) {
        await updateLocationInGameMode(gameModeId, location.index, newLocation);
        toast({ title: 'Success', description: 'Location updated.' });
      } else {
        await addLocationToGameMode(gameModeId, newLocation);
        toast({ title: 'Success', description: 'Location added.' });
      }
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to save location: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogTitle>{location ? 'Edit Location' : 'Add New Location'}</DialogTitle>
      <div>
        <Label htmlFor="loc-search">Search for a location</Label>
        <Popover open={isPredictionsOpen} onOpenChange={setIsPredictionsOpen}>
            <PopoverTrigger asChild>
                    <div className="w-full relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                        ref={inputRef}
                        id="loc-search"
                        placeholder="Eiffel Tower, Paris..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onFocus={() => { if (predictions.length > 0) setIsPredictionsOpen(true); }}
                        autoComplete="off"
                        className="pl-10"
                    />
                </div>
            </PopoverTrigger>
            <PopoverContent 
                className="w-[--radix-popover-trigger-width] p-0" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {loading && predictions.length === 0 && <div className="p-4 text-sm text-center">Searching...</div>}
                {predictions.map((p) => (
                    <div key={p.place_id}
                        className="p-2 hover:bg-accent cursor-pointer text-sm"
                        onMouseDown={(e) => { e.preventDefault(); handlePredictionSelect(p); }}>
                        {p.description}
                    </div>
                ))}
            </PopoverContent>
        </Popover>
      </div>

       <div>
        <Label htmlFor="loc-name">Display Name</Label>
        <Input
          id="loc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="This will be shown in the game"
        />
      </div>
      
      {coordinates && (
          <div className="text-sm text-muted-foreground">
              Lat: {coordinates.latitude.toFixed(4)}, Lng: {coordinates.longitude.toFixed(4)}
          </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !coordinates}>
          {loading ? <Loader2 className="animate-spin" /> : 'Save'}
        </Button>
      </div>
    </form>
  );
};


export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [gameModes, setGameModes] = useState<GameMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGameModeFormOpen, setIsGameModeFormOpen] = useState(false);
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);
  const [newGameModeName, setNewGameModeName] = useState('');
  const [editingGameMode, setEditingGameMode] = useState<GameMode | null>(null);
  const [editingLocation, setEditingLocation] = useState<(Location & { index: number }) | undefined>(undefined);
  const [selectedGameModeId, setSelectedGameModeId] = useState<string | null>(null);

  const fetchGameModes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const modes = await getUserGameModes(user.uid);
      setGameModes(modes);
    } catch (error: any) {
      toast({ title: 'Error', description: `Could not fetch game modes: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else {
         fetchGameModes();
      }
    }
  }, [user, authLoading, router, fetchGameModes]);

  
  const handleGameModeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameModeName || !user) return;

    try {
        if(editingGameMode) {
            await updateGameMode(editingGameMode.id, { ...editingGameMode, name: newGameModeName});
            toast({ title: 'Success', description: `Game mode "${newGameModeName}" updated.` });

        } else {
             await addGameMode({ name: newGameModeName, locations: [], userId: user.uid });
             toast({ title: 'Success', description: `Game mode "${newGameModeName}" created.` });
        }
       
      setNewGameModeName('');
      setEditingGameMode(null);
      setIsGameModeFormOpen(false);
      fetchGameModes();
    } catch (error: any) {
      toast({ title: 'Error', description: `Failed to save game mode: ${error.message}`, variant: 'destructive' });
    }
  };

  const handleDeleteGameMode = async (modeId: string, modeName: string) => {
    if(window.confirm(`Are you sure you want to delete the game mode "${modeName}"? This action cannot be undone.`)) {
        try {
            await deleteGameMode(modeId);
            toast({ title: 'Success', description: `Game mode "${modeName}" deleted.` });
            fetchGameModes();
        } catch (error: any) {
            toast({ title: 'Error', description: `Failed to delete game mode: ${error.message}`, variant: 'destructive' });
        }
    }
  }
  
  const handleDeleteLocation = async (gameModeId: string, locationIndex: number, locationName: string) => {
      if(window.confirm(`Are you sure you want to delete the location "${locationName}"?`)) {
          try {
              await deleteLocationFromGameMode(gameModeId, locationIndex);
              toast({ title: 'Success', description: `Location "${locationName}" deleted.` });
              fetchGameModes();
          } catch(error: any) {
              toast({ title: 'Error', description: `Failed to delete location: ${error.message}`, variant: 'destructive' });
          }
      }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between items-center gap-4">
             <div className="flex-grow">
                <CardTitle className="flex items-center gap-2"><Users /> Custom Game Modes</CardTitle>
                 <CardDescription>
                    Create and manage your own custom location lists to play with friends.
                </CardDescription>
             </div>
             <div className="flex items-center gap-2">
                <Dialog open={isGameModeFormOpen} onOpenChange={setIsGameModeFormOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setEditingGameMode(null); setNewGameModeName('');}}>
                            <Plus className="mr-2 h-4 w-4" /> Add New Game Mode
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingGameMode ? 'Edit' : 'Create'} Game Mode</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleGameModeSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="game-mode-name">Name</Label>
                                <Input
                                    id="game-mode-name"
                                    value={newGameModeName}
                                    onChange={(e) => setNewGameModeName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={() => setIsGameModeFormOpen(false)}>Cancel</Button>
                                <Button type="submit">Save</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
             </div>
          </div>
        </CardHeader>
        <CardContent>
           <Accordion type="single" collapsible className="w-full">
            {gameModes.map(mode => (
                <AccordionItem value={mode.id} key={mode.id}>
                    <div className="flex items-center w-full">
                        <AccordionTrigger className="flex-1 hover:no-underline">
                           <span className="text-lg font-semibold text-left">{mode.name} ({mode.locations?.length || 0} locations)</span>
                        </AccordionTrigger>
                        <div className="flex items-center gap-2 pl-4">
                            <Button size="sm" variant="outline" onClick={() => { setEditingGameMode(mode); setNewGameModeName(mode.name); setIsGameModeFormOpen(true);}}>
                                <Edit className="h-4 w-4"/>
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteGameMode(mode.id, mode.name)}>
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        </div>
                    </div>
                    <AccordionContent>
                        <div className="p-1 md:p-4 bg-muted/40 rounded-lg">
                             <div className="flex justify-end mb-4">
                                <Dialog open={isLocationFormOpen && selectedGameModeId === mode.id} onOpenChange={(open) => {
                                    if (!open) {
                                        setEditingLocation(undefined);
                                        setSelectedGameModeId(null);
                                    }
                                    setIsLocationFormOpen(open);
                                }}>
                                    <DialogTrigger asChild>
                                        <Button onClick={() => { setEditingLocation(undefined); setSelectedGameModeId(mode.id); setIsLocationFormOpen(true);}}>
                                            <Plus className="mr-2 h-4 w-4"/> Add Location
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <LocationForm 
                                            gameModeId={mode.id}
                                            location={editingLocation}
                                            onSave={fetchGameModes}
                                            onClose={() => {setIsLocationFormOpen(false); setEditingLocation(undefined);}}
                                        />
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Latitude</TableHead>
                                            <TableHead>Longitude</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {mode.locations?.map((loc, index) => (
                                            <TableRow key={`${mode.id}-${index}`}>
                                                <TableCell className="font-medium">{loc.name}</TableCell>
                                                <TableCell>{loc.coordinates.latitude.toFixed(4)}</TableCell>
                                                <TableCell>{loc.coordinates.longitude.toFixed(4)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end items-center">
                                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedGameModeId(mode.id); setEditingLocation({ ...loc, index }); setIsLocationFormOpen(true); }}>
                                                            <Edit className="h-4 w-4"/>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteLocation(mode.id, index, loc.name)}>
                                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {(!mode.locations || mode.locations.length === 0) && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center">No locations in this mode.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
           </Accordion>
           {gameModes.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                    <p>You haven't created any game modes yet.</p>
                    <p>Click "Add New Game Mode" to get started!</p>
                </div>
           )}
        </CardContent>
      </Card>
    </main>
  );
}

    