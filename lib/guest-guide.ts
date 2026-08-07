import { getRedis } from "@/lib/bookings";

export type GuestGuide = {
  checkInTime: string; checkOutTime: string;
  propertyName: string; address: string; mapsUrl: string; floor: string; apartmentNumber: string;
  directions: string; buildingCode: string; buildingEntryInstructions: string; apartmentDirections: string; lockboxCode: string; lockboxInstructions: string;
  wifiName: string; wifiPassword: string; hostName: string; hostPhone: string; parking: string;
  airConditioning: string; heating: string; hotWater: string; rubbish: string;
  quietHours: string; houseRules: string; checkoutInstructions: string; emergencyPhone: string;
};

export const defaultGuestGuide: GuestGuide = {
  checkInTime: "10:00", checkOutTime: "10:00",
  propertyName: "Konios House", address: "Zil Vern 12, Skopje", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Zil%20Vern%2012%2C%20Skopje", floor: "5", apartmentNumber: "32",
  directions: "Look for the building and the main glass entrance.", buildingCode: "2812", buildingEntryInstructions: "1. Press the telephone button.\n2. Enter the building code.\n3. Open the building door.", apartmentDirections: "Take the elevator or stairs to the 5th floor. Go straight, walk down the hall, and apartment 32 is on the right.", lockboxCode: "3007", lockboxInstructions: "The keybox is next to apartment 32.",
  wifiName: "", wifiPassword: "", hostName: "Dejan", hostPhone: "", parking: "Use the outdoor parking space marked 32.",
  airConditioning: "", heating: "", hotWater: "", rubbish: "",
  quietHours: "22:00–08:00", houseRules: "Please respect our neighbours, do not smoke indoors, and keep noise low during quiet hours.",
  checkoutInstructions: "Turn off lights and air conditioning, close the windows, lock the apartment, and return the key to the lockbox.", emergencyPhone: "112",
};

export async function getGuestGuide() {
  const stored = await getRedis().get<Partial<GuestGuide>>("guest-guide");
  if (!stored) return defaultGuestGuide;
  if (stored.apartmentDirections === undefined) {
    const migrated = { ...defaultGuestGuide, ...stored };
    for (const key of ["address","mapsUrl","floor","apartmentNumber","directions","buildingCode","buildingEntryInstructions","apartmentDirections","lockboxCode","lockboxInstructions","parking"] as const) {
      if (!stored[key]) migrated[key] = defaultGuestGuide[key];
    }
    return migrated;
  }
  return { ...defaultGuestGuide, ...stored };
}

export async function saveGuestGuide(value: GuestGuide) {
  await getRedis().set("guest-guide", value);
  return value;
}
