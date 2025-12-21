// Predefined list of cities supported by Laundrify
export const CITIES = [
  "Delhi",
  "Gurgaon",
  "Chandigarh",
  "Mohali",
  "Kharar",
];

// Get cities sorted alphabetically
export const getSortedCities = (): string[] => {
  return [...CITIES].sort();
};

// Check if a city is valid
export const isValidCity = (city: string): boolean => {
  return CITIES.some(c => c.toLowerCase() === city.toLowerCase());
};
