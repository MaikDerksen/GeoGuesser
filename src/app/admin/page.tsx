
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Edit, Trash2, X, Database } from 'lucide-react';
import {
  getAllGameModes,
  addGameMode,
  updateGameMode,
  deleteGameMode,
  addLocationToGameMode,
  updateLocationInGameMode,
  deleteLocationFromGameMode,
  seedDatabase, // Import the new seed function
  type GameMode,
  type Location
} from '@/lib/game-data';
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
} from "@/components/ui/accordion"


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
  const [lat, setLat] = useState(location?.coordinates.latitude.toString() || '');
  const [lng, setLng] = useState(location?.coordinates.longitude.toString() || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newLocation: Location = {
      name,
      coordinates: {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
      },
    };

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
        <Label htmlFor="loc-name">Location Name</Label>
        <Input
          id="loc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="loc-lat">Latitude</Label>
        <Input
          id="loc-lat"
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="loc-lng">Longitude</Label>
        <Input
          id="loc-lng"
          type="number"
          step="any"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          required
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
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
  const [isSeeding, setIsSeeding] = useState(false);


  const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID;

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.uid !== adminUid) {
        toast({ title: 'Access Denied', description: 'You do not have permission to view this page.', variant: 'destructive' });
        router.push('/');
      } else {
         fetchGameModes();
      }
    }
  }, [user, authLoading, router, adminUid, toast]);

  const fetchGameModes = async () => {
    setLoading(true);
    try {
      const modes = await getAllGameModes();
      setGameModes(modes);
    } catch (error: any) {
      toast({ title: 'Error', description: `Could not fetch game modes: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleGameModeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameModeName) return;

    try {
        if(editingGameMode) {
            await updateGameMode(editingGameMode.id, { ...editingGameMode, name: newGameModeName});
            toast({ title: 'Success', description: `Game mode "${newGameModeName}" updated.` });

        } else {
             await addGameMode({ name: newGameModeName, locations: [] });
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

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      await seedDatabase();
      toast({ title: 'Success', description: 'Sample game modes have been added to your database.' });
      fetchGameModes();
    } catch (error: any) {
       toast({ title: 'Error', description: `Failed to seed database: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSeeding(false);
    }
  };
  
  if (authLoading || loading || user?.uid !== adminUid) {
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
          <div className="flex justify-between items-center">
             <CardTitle>Admin Dashboard</CardTitle>
             <div className="flex items-center gap-2">
                <Button onClick={handleSeedDatabase} variant="outline" disabled={isSeeding}>
                  { isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />} Seed Database
                </Button>
                <Dialog open={isGameModeFormOpen} onOpenChange={setIsGameModeFormOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setEditingGameMode(null); setNewGameModeName('');}}>
                            <Plus className="mr-2 h-4 w-4" /> Add Game Mode
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
          <CardDescription>
            Manage game modes and their locations. Click "Seed Database" to add sample data.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Accordion type="single" collapsible className="w-full">
            {gameModes.map(mode => (
                <AccordionItem value={mode.id} key={mode.id}>
                    <div className="flex items-center justify-between w-full pr-4 py-4">
                        <AccordionTrigger className="flex-1">
                            <span className="text-lg font-semibold">{mode.name} ({mode.locations?.length || 0} locations)</span>
                        </AccordionTrigger>
                         <div className="flex items-center gap-2 pl-4">
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditingGameMode(mode); setNewGameModeName(mode.name); setIsGameModeFormOpen(true);}}>
                                <Edit className="h-4 w-4"/>
                            </Button>
                             <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDeleteGameMode(mode.id, mode.name);}}>
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        </div>
                    </div>
                    <AccordionContent>
                        <div className="p-4 bg-muted/40 rounded-lg">
                             <div className="flex justify-end mb-4">
                                <Dialog open={isLocationFormOpen && selectedGameModeId === mode.id} onOpenChange={(open) => {
                                    if (!open) {
                                        setEditingLocation(undefined);
                                        setSelectedGameModeId(null);
                                    }
                                    setIsLocationFormOpen(open);
                                }}>
                                    <DialogTrigger asChild>
                                        <Button onClick={() => setSelectedGameModeId(mode.id)}>
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
                                            <TableCell>{loc.name}</TableCell>
                                            <TableCell>{loc.coordinates.latitude}</TableCell>
                                            <TableCell>{loc.coordinates.longitude}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => { setSelectedGameModeId(mode.id); setEditingLocation({ ...loc, index }); setIsLocationFormOpen(true); }}>
                                                    <Edit className="h-4 w-4"/>
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteLocation(mode.id, index, loc.name)}>
                                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                                </Button>
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
                    </AccordionContent>
                </AccordionItem>
            ))}
           </Accordion>
        </CardContent>
      </Card>
    </main>
  );
}
