export interface DailyQuote {
  text: string;
  author: string;
}

export const dailyQuotes: DailyQuote[] = [
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "Your excuses are nothing more than the lies your fears have sold you.", author: "Robin Sharma" },
  { text: "Don't live the same year 75 times and call it a life.", author: "Robin Sharma" },
  { text: "The moment you take responsibility for everything in your life is the moment you can change anything.", author: "Hal Elrod" },
  { text: "We suffer more in imagination than in reality.", author: "Seneca" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "Waste no more time arguing about what a good person should be. Be one.", author: "Marcus Aurelius" },
  { text: "It is not that we have a short time to live, but that we waste a great deal of it.", author: "Seneca" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "What you do every day matters more than what you do once in a while.", author: "Gretchen Rubin" },
  { text: "Champions don't do extraordinary things. They do ordinary things, but they do them without thinking.", author: "Charles Duhigg" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Mastery is not about perfection. It's about a process, a journey.", author: "George Leonard" },
  { text: "All great changes are preceded by chaos.", author: "Deepak Chopra" },
  { text: "Be where you are, not where you think you should be.", author: "Unknown" },
  { text: "A genius is simply someone who has taken full ownership of their mind.", author: "Robin Sharma" },
  { text: "Change is hard at first, messy in the middle, and gorgeous at the end.", author: "Robin Sharma" },
  { text: "Victims make excuses. Leaders deliver results.", author: "Robin Sharma" },
  { text: "The fears we don't face become our limits.", author: "Robin Sharma" },
  { text: "If you want to have more, you have to become more.", author: "Jim Rohn" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Rohn" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "The quality of your life is determined by the quality of your thoughts.", author: "Marcus Aurelius" },
  { text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "The mind is everything. What you think you become.", author: "Buddha" },
  { text: "Your current habits are perfectly designed to deliver your current results.", author: "James Clear" },
  { text: "Every action you take is a vote for the type of person you wish to become.", author: "James Clear" },
  { text: "The pain of discipline weighs ounces while the pain of regret weighs tons.", author: "Jim Rohn" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "The world makes way for the person who knows where they are going.", author: "Ralph Waldo Emerson" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "One day or day one. You decide.", author: "Unknown" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "The greatest wealth is health.", author: "Virgil" },
  { text: "Sleep is the best meditation.", author: "Dalai Lama" },
  { text: "When you own your morning, you elevate your life.", author: "Robin Sharma" },
];

export function getTodayQuote(): DailyQuote {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return dailyQuotes[dayOfYear % dailyQuotes.length];
}
