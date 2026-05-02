"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Headphones, Play, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface GeneratedMeditation {
  id: string;
  meditationType: string;
  durationS: number;
  generatedAt: string;
}

interface MyMeditationsProps {
  onReplay: (meditationId: string) => void;
}

export function MyMeditations({ onReplay }: MyMeditationsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAll, setShowAll] = useState(false);

  const { data: meditations, isLoading } = useQuery<GeneratedMeditation[]>({
    queryKey: ["/api/meditation/generated"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/meditation/generated/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meditation/generated"] });
      toast({ title: "Deleted", description: "Meditation removed." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete." });
    },
  });

  if (isLoading) return null;
  if (!meditations || meditations.length === 0) {
    return (
      <Card data-testid="card-my-meditations">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Headphones className="h-5 w-5 text-purple-500" />
            My Meditations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-meditations">
            No generated meditations yet. Try generating one above!
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayed = showAll ? meditations : meditations.slice(0, 5);

  return (
    <Card data-testid="card-my-meditations">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Headphones className="h-5 w-5 text-purple-500" />
          My Meditations
          <Badge variant="secondary" className="ml-auto text-xs">{meditations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayed.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
            data-testid={`generated-meditation-${m.id}`}
          >
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {m.meditationType}
            </Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">
                {Math.round(m.durationS / 60)} min · {new Date(m.generatedAt).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-purple-500 hover:text-purple-400"
              onClick={() => onReplay(m.id)}
              data-testid={`button-replay-${m.id}`}
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => deleteMutation.mutate(m.id)}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${m.id}`}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        ))}
        {meditations.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowAll(!showAll)}
            data-testid="button-show-more-meditations"
          >
            {showAll ? (
              <>Show less <ChevronUp className="h-4 w-4 ml-1" /></>
            ) : (
              <>Show all ({meditations.length}) <ChevronDown className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
