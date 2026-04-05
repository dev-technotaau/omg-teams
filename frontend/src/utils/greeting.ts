// ──────────────────────────────────────────────
//  Personalized Time-Based Greeting
//  "Good morning, Rahul!" / "Good evening, Admin!"
// ──────────────────────────────────────────────

export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  let timeGreeting: string;

  if (hour < 5) {
    timeGreeting = "Good night";
  } else if (hour < 12) {
    timeGreeting = "Good morning";
  } else if (hour < 17) {
    timeGreeting = "Good afternoon";
  } else if (hour < 21) {
    timeGreeting = "Good evening";
  } else {
    timeGreeting = "Good night";
  }

  const displayName = name?.split(" ")[0] ?? "there";
  return `${timeGreeting}, ${displayName}!`;
}

export function getGreetingEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "\u{1F31C}"; // 🌜
  if (hour < 12) return "\u{1F305}"; // 🌅
  if (hour < 17) return "\u{2600}\uFE0F"; // ☀️
  if (hour < 21) return "\u{1F307}"; // 🌇
  return "\u{1F31C}"; // 🌜
}
