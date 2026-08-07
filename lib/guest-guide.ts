import { getRedis } from "@/lib/bookings";

export type MessageTemplate = {
  id: string;
  title: string;
  category: string;
  content: string;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category?: string;
};

export const defaultMessageTemplates: MessageTemplate[] = [
  {
    id: "tpl-1",
    title: "Payment / Tourist Tax in Keybox",
    category: "Payment & Tax",
    content: "Hi {guestName}! Hope you are settling in nicely. Please leave the remaining cash/tourist tax inside the key lockbox (code 3007) when convenient and send us a quick message so someone from our team can come by to pick it up. Thank you so much!",
  },
  {
    id: "tpl-2",
    title: "Airport Taxi Transfer Offer",
    category: "Arrival",
    content: "Hello {guestName}! Do you need a taxi transfer arranged from Skopje International Airport directly to Konios House? If so, please share your flight number and expected landing time, and we'll gladly arrange a driver to meet you!",
  },
  {
    id: "tpl-3",
    title: "Check-in Instructions & Access Code",
    category: "Arrival",
    content: "Hi {guestName}! Your stay at Konios House is coming up soon. Your private entry code is {code}, valid from 10:00 AM on check-in day. You can view your full digital guide and directions here: {guideUrl}",
  },
  {
    id: "tpl-4",
    title: "Mid-Stay Courtesy Check-in",
    category: "Stay",
    content: "Hi {guestName}, checking in to see if everything is comfortable with your stay! If you need extra towels, toilet paper, or local recommendations for Skopje, please let us know anytime.",
  },
  {
    id: "tpl-5",
    title: "Checkout Instructions & Reminder",
    category: "Departure",
    content: "Dear {guestName}, as a reminder, checkout is tomorrow at 10:00 AM. Please turn off AC/heating, close windows, lock the door, and return the key to lockbox 3007. Wishing you safe travels ahead!",
  },
];

export const defaultFaqs: FaqItem[] = [
  {
    id: "faq-1",
    question: "Where do I park my car?",
    answer: "We have a dedicated outdoor parking space (marked 32) right next to the building entrance. It is completely free for your stay.",
    category: "Parking & Access",
  },
  {
    id: "faq-2",
    question: "How do I enter the building and apartment?",
    answer: "Press the telephone button on the main entrance intercom, enter code 2812, and open the door. Take the elevator or stairs to the 5th floor. Apartment 32 is on the right, and keybox 3007 is right beside the door.",
    category: "Parking & Access",
  },
  {
    id: "faq-3",
    question: "Is tap water in Skopje safe to drink?",
    answer: "Yes! Tap water in Skopje is clean, safe, and pleasant to drink.",
    category: "Apartment & Amenities",
  },
  {
    id: "faq-4",
    question: "Can I check in early or leave my bags?",
    answer: "Early check-in depends on whether we have guests checking out on the same morning. Send Dejan or Ivana a message in advance, and we will do our best to accommodate you!",
    category: "Arrival & Departure",
  },
  {
    id: "faq-5",
    question: "Where are the nearest grocery stores and bakeries?",
    answer: "Kipper Market is right next door for everyday groceries. Crown 1985 bakery is 100 meters away for fresh burek and bread, and Silbo Bakery is a short walk away.",
    category: "Local Area",
  },
  {
    id: "faq-6",
    question: "How do I call a reliable taxi in Skopje?",
    answer: "We recommend downloading the Wizi app or calling Nashe Taxi at 15152 (or +389 70 813 037 for airport taxi). For street taxis, make sure they run the meter.",
    category: "Local Area",
  },
];

export type GalleryItem = {
  id: string;
  url: string;
  title: string;
  category?: string;
};

export const defaultGallery: GalleryItem[] = [
  {
    id: "gal-1",
    url: "/gallery/living-room.jpg",
    title: "Spacious Living Room",
    category: "Living Room",
  },
  {
    id: "gal-2",
    url: "/gallery/bedroom.jpg",
    title: "Master Bedroom & King Bed",
    category: "Bedroom",
  },
  {
    id: "gal-3",
    url: "/gallery/kitchen.jpg",
    title: "Modern Fully-Equipped Kitchen",
    category: "Kitchen",
  },
  {
    id: "gal-4",
    url: "/apartment-main.png",
    title: "Living Area & Dining Nook",
    category: "Interior",
  },
  {
    id: "gal-5",
    url: "/self-checkin-guide.png",
    title: "Building Entrance & Keybox",
    category: "Access",
  },
];

export type GuestGuide = {
  checkInTime: string; checkOutTime: string;
  propertyName: string; address: string; mapsUrl: string; floor: string; apartmentNumber: string;
  directions: string; buildingCode: string; buildingEntryInstructions: string; apartmentDirections: string; lockboxCode: string; lockboxInstructions: string;
  wifiName: string; wifiPassword: string; hostName: string; hostPhone: string; hostPhotoUrl: string; welcomeMessage: string; parkingSpace: string; parking: string;
  airConditioning: string; heating: string; hotWater: string; rubbish: string;
  quietHours: string; houseRules: string; checkoutInstructions: string; emergencyPhone: string;
  step1PhotoUrl?: string; step2PhotoUrl?: string; step3PhotoUrl?: string; step4PhotoUrl?: string; step5PhotoUrl?: string; step6PhotoUrl?: string;
  messageTemplates: MessageTemplate[];
  faqs: FaqItem[];
  gallery: GalleryItem[];
};

export const defaultGuestGuide: GuestGuide = {
  checkInTime: "10:00", checkOutTime: "10:00",
  propertyName: "Konios House", address: "Zil Vern 12, Skopje", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Zil%20Vern%2012%2C%20Skopje", floor: "5", apartmentNumber: "32",
  directions: "Look for the building and the main glass entrance.", buildingCode: "2812", buildingEntryInstructions: "1. Press the telephone button.\n2. Enter the building code.\n3. Open the building door.", apartmentDirections: "Take the elevator or stairs to the 5th floor. Go straight, walk down the hall, and apartment 32 is on the right.", lockboxCode: "3007", lockboxInstructions: "The keybox is next to apartment 32.",
  wifiName: "", wifiPassword: "", hostName: "Dejan & Ivana", hostPhone: "", hostPhotoUrl: "/host-profile.jpg", welcomeMessage: "Welcome to Konios House! We are delighted to host you in Skopje. If you need anything during your stay, don't hesitate to reach out. Wish you a wonderful visit!", parkingSpace: "32", parking: "Use the outdoor parking space marked 32.",
  airConditioning: "", heating: "", hotWater: "", rubbish: "",
  quietHours: "22:00–08:00", houseRules: "Please respect our neighbours, do not smoke indoors, and keep noise low during quiet hours.",
  checkoutInstructions: "Turn off lights and air conditioning, close the windows, lock the apartment, and return the key to the lockbox.", emergencyPhone: "112",
  step1PhotoUrl: "/self-checkin-guide.png",
  step2PhotoUrl: "/self-checkin-guide.png",
  step3PhotoUrl: "/self-checkin-guide.png",
  step4PhotoUrl: "/self-checkin-guide.png",
  step5PhotoUrl: "/self-checkin-guide.png",
  step6PhotoUrl: "/apartment-main.png",
  messageTemplates: defaultMessageTemplates,
  faqs: defaultFaqs,
  gallery: defaultGallery,
};

export async function getGuestGuide() {
  const stored = await getRedis().get<Partial<GuestGuide>>("guest-guide");
  if (!stored) return defaultGuestGuide;
  const merged: GuestGuide = { ...defaultGuestGuide, ...stored };
  if (!merged.messageTemplates || !Array.isArray(merged.messageTemplates) || merged.messageTemplates.length === 0) {
    merged.messageTemplates = defaultMessageTemplates;
  }
  if (!merged.faqs || !Array.isArray(merged.faqs) || merged.faqs.length === 0) {
    merged.faqs = defaultFaqs;
  }
  if (!merged.gallery || !Array.isArray(merged.gallery) || merged.gallery.length === 0) {
    merged.gallery = defaultGallery;
  }
  return merged;
}

export async function saveGuestGuide(value: GuestGuide) {
  await getRedis().set("guest-guide", value);
  return value;
}

