export interface DailySong {
  title: string;
  artist: string;
  why: string;
}

export const dailySongs: DailySong[] = [
  { title: "Eye of the Tiger", artist: "Survivor", why: "Pure focus and forward motion." },
  { title: "Lose Yourself", artist: "Eminem", why: "Seize the moment — one shot." },
  { title: "Stronger", artist: "Kanye West", why: "What doesn't kill you makes you stronger." },
  { title: "Don't Stop Believin'", artist: "Journey", why: "Keep going — the streetlight people are with you." },
  { title: "Wake Me Up", artist: "Avicii", why: "Find yourself by living it." },
  { title: "Roar", artist: "Katy Perry", why: "Your voice matters." },
  { title: "Hall of Fame", artist: "The Script", why: "You can be a champion." },
  { title: "Brave", artist: "Sara Bareilles", why: "Say what you wanna say." },
  { title: "The Climb", artist: "Miley Cyrus", why: "It's the climb, not the destination." },
  { title: "Try Everything", artist: "Shakira", why: "I won't give up, no I won't give in." },
  { title: "Believer", artist: "Imagine Dragons", why: "Pain made you a believer." },
  { title: "Whatever It Takes", artist: "Imagine Dragons", why: "Push past the limit." },
  { title: "Thunder", artist: "Imagine Dragons", why: "Lightning before the thunder." },
  { title: "Unstoppable", artist: "Sia", why: "I'm unstoppable today." },
  { title: "Titanium", artist: "David Guetta ft. Sia", why: "Bulletproof. Nothing to lose." },
  { title: "Fight Song", artist: "Rachel Platten", why: "This is your fight song." },
  { title: "Stronger (What Doesn't Kill You)", artist: "Kelly Clarkson", why: "Stand a little taller." },
  { title: "Confident", artist: "Demi Lovato", why: "What's wrong with being confident?" },
  { title: "Rise Up", artist: "Andra Day", why: "Move mountains today." },
  { title: "On Top of the World", artist: "Imagine Dragons", why: "Waiting on this for a while now." },
  { title: "Good Day", artist: "Surfaces", why: "It's a good day to have a good day." },
  { title: "Happy", artist: "Pharrell Williams", why: "Clap along if you feel it." },
  { title: "Walking on Sunshine", artist: "Katrina & The Waves", why: "And don't it feel good." },
  { title: "Best Day of My Life", artist: "American Authors", why: "Today's gonna be the best." },
  { title: "Three Little Birds", artist: "Bob Marley", why: "Every little thing is gonna be alright." },
  { title: "Here Comes the Sun", artist: "The Beatles", why: "The ice is slowly melting." },
  { title: "Lovely Day", artist: "Bill Withers", why: "Just to think about you." },
  { title: "Beautiful Day", artist: "U2", why: "Don't let it get away." },
];

export function getTodaySong(): DailySong {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return dailySongs[dayOfYear % dailySongs.length];
}
