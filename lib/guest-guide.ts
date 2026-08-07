import { getRedis } from "@/lib/bookings";

export type GuestGuide = {
  checkInTime: string; checkOutTime: string;
  propertyName: string; address: string; mapsUrl: string; floor: string; apartmentNumber: string;
  directions: string; buildingCode: string; lockboxCode: string; lockboxInstructions: string;
  wifiName: string; wifiPassword: string; hostName: string; hostPhone: string; parking: string;
  airConditioning: string; heating: string; hotWater: string; rubbish: string;
  quietHours: string; houseRules: string; checkoutInstructions: string; emergencyPhone: string;
};

export const defaultGuestGuide: GuestGuide = {
  checkInTime: "10:00", checkOutTime: "10:00",
  propertyName: "Konios House", address: "", mapsUrl: "", floor: "", apartmentNumber: "",
  directions: "", buildingCode: "", lockboxCode: "", lockboxInstructions: "",
  wifiName: "", wifiPassword: "", hostName: "Dejan", hostPhone: "", parking: "",
  airConditioning: "", heating: "", hotWater: "", rubbish: "",
  quietHours: "22:00–08:00", houseRules: "Please respect our neighbours, do not smoke indoors, and keep noise low during quiet hours.",
  checkoutInstructions: "Turn off lights and air conditioning, close the windows, lock the apartment, and return the key to the lockbox.", emergencyPhone: "112",
};

export async function getGuestGuide() {
  const stored = await getRedis().get<Partial<GuestGuide>>("guest-guide");
  return { ...defaultGuestGuide, ...(stored ?? {}) };
}

export async function saveGuestGuide(value: GuestGuide) {
  await getRedis().set("guest-guide", value);
  return value;
}
