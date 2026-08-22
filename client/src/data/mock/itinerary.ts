import type { Itinerary, ItineraryDay } from "@/types";

const europeDays: ItineraryDay[] = [
  {
    id: "day-1",
    date: "2026-08-20",
    stopId: "stop-1",
    cityName: "London",
    items: [
      { id: "i-1", time: "09:00", title: "Breakfast at a Soho café", category: "Meal", cost: 900, location: "Soho" },
      { id: "i-2", time: "10:30", title: "London Eye", category: "Sightseeing", activityId: "act-london-eye", durationHours: 1, cost: 4500, location: "South Bank", notes: "Pre-book the fast-track ticket." },
      { id: "i-3", time: "13:00", title: "Lunch at Borough Market", category: "Meal", cost: 1200, location: "Borough Market" },
      { id: "i-4", time: "15:00", title: "British Museum", category: "Culture", activityId: "act-london-british-museum", durationHours: 3, cost: 0, location: "Bloomsbury" },
      { id: "i-5", time: "19:30", title: "Dinner & pub crawl in Camden", category: "Nightlife", cost: 2500, location: "Camden" },
    ],
  },
  {
    id: "day-2",
    date: "2026-08-21",
    stopId: "stop-1",
    cityName: "London",
    items: [
      { id: "i-6", time: "09:30", title: "Tower of London", category: "Sightseeing", durationHours: 2, cost: 3300, location: "Tower Hill" },
      { id: "i-7", time: "12:30", title: "Borough Market Food Tour", category: "Food", activityId: "act-london-borough", durationHours: 2, cost: 3200 },
      { id: "i-8", time: "16:00", title: "Walk the South Bank", category: "Sightseeing", cost: 0, notes: "Free — great sunset views." },
    ],
  },
  {
    id: "day-3",
    date: "2026-08-22",
    stopId: "stop-1",
    cityName: "London",
    items: [
      { id: "i-9", time: "10:00", title: "Shopping on Oxford Street", category: "Shopping", cost: 5000, location: "West End" },
      { id: "i-10", time: "14:00", title: "Hyde Park picnic", category: "Rest", cost: 800 },
      { id: "i-11", time: "20:00", title: "West End theatre show", category: "Nightlife", cost: 6000 },
    ],
  },
  {
    id: "day-4",
    date: "2026-08-23",
    stopId: "stop-2",
    cityName: "Paris",
    items: [
      { id: "i-12", time: "08:00", title: "Eurostar to Paris", category: "Transport", durationHours: 3, cost: 8500, location: "St Pancras → Gare du Nord" },
      { id: "i-13", time: "13:00", title: "Lunch near the Marais", category: "Meal", cost: 1600 },
      { id: "i-14", time: "16:00", title: "Eiffel Tower Summit", category: "Sightseeing", activityId: "act-paris-eiffel", durationHours: 2, cost: 5200 },
    ],
  },
  {
    id: "day-5",
    date: "2026-08-24",
    stopId: "stop-2",
    cityName: "Paris",
    items: [
      { id: "i-15", time: "09:30", title: "Louvre Museum", category: "Culture", activityId: "act-paris-louvre", durationHours: 4, cost: 1700 },
      { id: "i-16", time: "14:30", title: "Lunch in the Latin Quarter", category: "Meal", cost: 1800 },
      { id: "i-17", time: "20:00", title: "Seine River Dinner Cruise", category: "Food", activityId: "act-paris-seine", durationHours: 3, cost: 9800 },
    ],
  },
  {
    id: "day-6",
    date: "2026-08-25",
    stopId: "stop-2",
    cityName: "Paris",
    items: [
      { id: "i-18", time: "10:00", title: "Montmartre & Sacré-Cœur", category: "Sightseeing", cost: 0 },
      { id: "i-19", time: "13:00", title: "Crêpes for lunch", category: "Meal", cost: 900 },
      { id: "i-20", time: "15:30", title: "Musée d'Orsay", category: "Culture", durationHours: 2, cost: 1500 },
    ],
  },
  {
    id: "day-7",
    date: "2026-08-26",
    stopId: "stop-3",
    cityName: "Rome",
    items: [
      { id: "i-21", time: "09:00", title: "Flight Paris → Rome", category: "Transport", durationHours: 2, cost: 7200 },
      { id: "i-22", time: "14:00", title: "Lunch in Trastevere", category: "Meal", cost: 1500 },
      { id: "i-23", time: "17:00", title: "Evening stroll to the Trevi Fountain", category: "Sightseeing", cost: 0 },
    ],
  },
  {
    id: "day-8",
    date: "2026-08-27",
    stopId: "stop-3",
    cityName: "Rome",
    items: [
      { id: "i-24", time: "08:30", title: "Colosseum & Roman Forum", category: "Culture", activityId: "act-rome-colosseum", durationHours: 3, cost: 3800 },
      { id: "i-25", time: "13:00", title: "Pizza al taglio lunch", category: "Meal", cost: 700 },
      { id: "i-26", time: "18:00", title: "Trastevere Pasta-Making Class", category: "Food", activityId: "act-rome-pasta", durationHours: 3, cost: 6500 },
    ],
  },
  {
    id: "day-9",
    date: "2026-08-28",
    stopId: "stop-3",
    cityName: "Rome",
    items: [
      { id: "i-27", time: "09:00", title: "Vatican Museums & Sistine Chapel", category: "Culture", activityId: "act-rome-vatican", durationHours: 4, cost: 4200 },
      { id: "i-28", time: "14:30", title: "Lunch near St. Peter's", category: "Meal", cost: 1600 },
      { id: "i-29", time: "17:00", title: "Gelato & Piazza Navona", category: "Rest", cost: 400 },
    ],
  },
  {
    id: "day-10",
    date: "2026-08-29",
    stopId: "stop-3",
    cityName: "Rome",
    items: [
      { id: "i-30", time: "10:00", title: "Villa Borghese gardens", category: "Nature", cost: 0 },
      { id: "i-31", time: "13:00", title: "Farewell Roman feast", category: "Meal", cost: 3000 },
      { id: "i-32", time: "16:00", title: "Last-minute souvenir shopping", category: "Shopping", cost: 2500 },
    ],
  },
];

export const mockItineraries: Record<string, Itinerary> = {
  "trip-1": { tripId: "trip-1", days: europeDays },
};

export function getItineraryByTrip(tripId: string): Itinerary {
  return mockItineraries[tripId] ?? { tripId, days: [] };
}
