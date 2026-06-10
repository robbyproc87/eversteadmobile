import type { Feather } from "@expo/vector-icons";

import { supabase } from "./supabase";

export interface AmbientSound {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  storagePath: string | null;
}

// Streamed from the public `ambient-sounds` Supabase Storage bucket.
export const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: "none", name: "None", icon: "volume-x", storagePath: null },
  { id: "rain", name: "Rain", icon: "cloud-rain", storagePath: "rain.mp3" },
  { id: "ocean", name: "Ocean", icon: "wind", storagePath: "ocean.mp3" },
  { id: "forest", name: "Forest", icon: "feather", storagePath: "forest.mp3" },
  { id: "bowls", name: "Bowls", icon: "circle", storagePath: "bowls.mp3" },
  {
    id: "white-noise",
    name: "White Noise",
    icon: "radio",
    storagePath: "white-noise.mp3",
  },
  { id: "stream", name: "Stream", icon: "droplet", storagePath: "stream.mp3" },
];

export function getAmbientSoundUrl(storagePath: string): string | null {
  try {
    const { data } = supabase.storage
      .from("ambient-sounds")
      .getPublicUrl(storagePath);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}
