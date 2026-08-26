const FUN_FACTS = [
  "Honey never spoils — pots found in Egyptian tombs were still edible.",
  "Octopuses have three hearts and blue blood.",
  "A group of flamingos is called a flamboyance.",
  "Bananas are berries; strawberries are not.",
  "Wombat poo is cube-shaped so it doesn’t roll away.",
  "The shortest war in history lasted 38 minutes (Zanzibar, 1896).",
  "Otters hold hands when they sleep so they don’t drift apart.",
  "A day on Venus is longer than a year on Venus.",
  "Cows have best friends and get stressed when they are separated.",
  "The inventor of the Pringles can is buried in one.",
  "A shrimp’s heart is in its head.",
  "Scotland’s national animal is the unicorn.",
  "Butterflies taste with their feet.",
  "There are more stars in the universe than grains of sand on Earth.",
  "Sloths can hold their breath longer than dolphins — up to 40 minutes.",
  "The Eiffel Tower grows about 15 cm in summer as the iron expands.",
  "A group of pugs is called a grumble.",
  "Hot water can freeze faster than cold water (the Mpemba effect).",
  "Sea otters have the densest fur of any mammal.",
  "The average cloud weighs more than a million pounds.",
  "Cats can’t taste sweetness.",
  "Pineapples take about two years to grow.",
  "A bolt of lightning is five times hotter than the sun’s surface.",
  "The moon is slowly drifting away from Earth — about 4 cm a year.",
  "Pigeons can recognise themselves in a mirror.",
  "The world’s oldest known living tree is over 4,800 years old.",
  "Dolphins have names for each other — unique whistle signatures.",
  "A teaspoon of honey is the life work of 12 bees.",
  "Koalas have fingerprints almost identical to humans.",
  "The heart of a blue whale is the size of a small car.",
  "Some apples can float because they’re 25% air.",
  "A crocodile cannot stick its tongue out.",
  "The first oranges weren’t orange — they were green.",
  "An albatross can sleep while flying.",
  "There are more possible chess games than atoms in the observable universe.",
  "A snail can sleep for three years.",
  "The Great Wall of China is not visible from the Moon with the naked eye.",
  "Reindeer eyes change colour with the seasons.",
  "Peanuts are not nuts — they’re legumes.",
  "A day on Mars is only 37 minutes longer than a day on Earth.",
];

export function funFactForDate(date: Date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return FUN_FACTS[((dayOfYear % FUN_FACTS.length) + FUN_FACTS.length) % FUN_FACTS.length];
}

export function funFactCount() {
  return FUN_FACTS.length;
}
