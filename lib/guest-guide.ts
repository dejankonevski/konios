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
    content: "Hi {guestName}! Please remember to leave the exact cash amount of {amountDue} {currency} in the lockbox and let us know once it is there, so we can arrange collection. Thank you!",
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
    content: "Hi {guestName}! Your check-in is today at {checkInTime}. Your private guest guide is {guideUrl} and your five-digit PIN is {code}. Do you need any assistance with arrival?",
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
  { id:"tpl-6", title:"Checkout today", category:"Departure", content:"Good morning {firstName}! Please remember that checkout today is at {checkOut} by 10:00. Kindly return the key to the lockbox and message us when you have left. Safe travels!" },
  { id:"tpl-7", title:"Exact location", category:"Arrival", content:"Hi {firstName}! The exact location is here: {guideUrl}. Open the private guide, enter PIN {code}, then tap Google Maps under the first arrival step." },
  { id:"tpl-8", title:"Text check-in instructions", category:"Arrival", content:"ARRIVAL: Check-in is at {checkInTime}. Open {guideUrl} with PIN {code}. Follow the building and parking photos first. Building and lockbox details appear at 14:30 when the apartment is ready." },
  { id:"tpl-9", title:"Hot water / boiler", category:"Apartment", content:"Hi {firstName}! For hot water, please switch on the boiler and allow approximately 20–30 minutes to heat. If the water remains cold, send us a photo of the boiler switch and we’ll assist immediately." },
  { id:"tpl-10", title:"Late check-in available", category:"Arrival", content:"Hi {firstName}! Late check-in is possible because access is self-service. Please keep the private guide and PIN {code} available, and message us if you need help." },
  { id:"tpl-11", title:"Late check-in unavailable", category:"Arrival", content:"Hi {firstName}, unfortunately we cannot accommodate the requested late check-in because host assistance is not available at that time. Check-in remains at {checkInTime}. Thank you for understanding." },
  { id:"tpl-12", title:"Late checkout available", category:"Departure", content:"Hi {firstName}! We can approve a late checkout this time. We’ll confirm the exact departure time separately. Please message us when you leave." },
  { id:"tpl-13", title:"Late checkout unavailable", category:"Departure", content:"Hi {firstName}, unfortunately we cannot offer late checkout because the apartment must be prepared for the next guest. Checkout remains at 10:00. Thank you for understanding." },
  { id:"tpl-14", title:"Early check-in unavailable", category:"Arrival", content:"Hi {firstName}, the apartment is still being cleaned, so early check-in is not possible. It will be ready at {checkInTime}, and access details will appear in your guide at 14:30." },
  { id:"tpl-15", title:"Early check-in available", category:"Arrival", content:"Good news, {firstName}! The apartment is ready earlier than expected. You may check in now using your private guide {guideUrl} and PIN {code}." },
  { id:"tpl-16", title:"Parking space occupied", category:"Parking", content:"Hi {firstName}, thank you for telling us the parking space is occupied. Please send a photo of the vehicle and license plate and wait nearby while we arrange removal." },
  { id:"tpl-17", title:"Wi-Fi help", category:"Apartment", content:"Hi {firstName}! The Wi-Fi network is {wifiName} and the password is {wifiPassword}. If it does not connect, forget the network, reconnect, and send us a screenshot if the issue continues." },
  { id:"tpl-18", title:"Quiet hours reminder", category:"Stay", content:"Hi {firstName}, a friendly reminder that this is a residential building. Please keep noise low during quiet hours and avoid loud music. Thank you for helping us respect our neighbours." },
  { id:"tpl-19", title:"Payment received", category:"Payment & Tax", content:"Thank you, {firstName}. We confirm receipt of your payment. Your outstanding balance is now 0 {currency}." },
  { id:"tpl-20", title:"Payment still due", category:"Payment & Tax", content:"Hi {firstName}, a balance of {amountDue} {currency} is still due. Please leave the exact cash amount in the lockbox and tell us once it is ready for collection." },
  { id:"tpl-21", title:"ID registration reminder", category:"Registration", content:"Hi {firstName}, we still need the guest identification details required for registration. Please send a clear photo of each guest’s passport or ID through the agreed secure channel." },
  { id:"tpl-22", title:"Everything okay?", category:"Stay", content:"Hi {firstName}! We hope everything is going well. Is the apartment comfortable, and is there anything we can help with today?" },
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
  defaultCleaningFeeMkd?: number;
  step1PhotoUrl?: string; step2PhotoUrl?: string; step3PhotoUrl?: string; step4PhotoUrl?: string; step5PhotoUrl?: string; step6PhotoUrl?: string;
  messageTemplates: MessageTemplate[];
  faqs: FaqItem[];
  gallery: GalleryItem[];
};

export const defaultGuestGuide: GuestGuide = {
  checkInTime: "15:00", checkOutTime: "10:00",
  defaultCleaningFeeMkd: 750,
  propertyName: "Konios House", address: "Zil Vern 12, Skopje", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Zil%20Vern%2012%2C%20Skopje", floor: "5", apartmentNumber: "32",
  directions: "Look for the building and the main glass entrance.", buildingCode: "2812", buildingEntryInstructions: "1. Press the telephone button.\n2. Enter the building code.\n3. Open the building door.", apartmentDirections: "Take the elevator or stairs to the 5th floor. Go straight, walk down the hall, and apartment 32 is on the right.", lockboxCode: "3007", lockboxInstructions: "The keybox is next to apartment 32.",
  wifiName: "", wifiPassword: "", hostName: "Dejan & Ivana", hostPhone: "", hostPhotoUrl: "/host-profile.jpg", welcomeMessage: "Welcome to Konios House! We are delighted to host you in Skopje. If you need anything during your stay, don't hesitate to reach out. Wish you a wonderful visit!", parkingSpace: "32", parking: "Use the outdoor parking space marked 32.",
  airConditioning: "", heating: "", hotWater: "", rubbish: "",
  quietHours: "22:00–08:00", houseRules: "Please respect our neighbours, do not smoke indoors, and keep noise low during quiet hours.",
  checkoutInstructions: "Turn off lights and air conditioning, close the windows, lock the apartment, and return the key to the lockbox.", emergencyPhone: "112",
  step1PhotoUrl: "/arrival-building.jpg",
  step2PhotoUrl: "/arrival-parking.jpg",
  step3PhotoUrl: "/arrival-intercom-optimized.jpg",
  step4PhotoUrl: "/arrival-elevator-optimized.jpg",
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
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(merged.checkInTime)) merged.checkInTime = "15:00";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(merged.checkOutTime)) merged.checkOutTime = "10:00";
  if (!merged.messageTemplates || !Array.isArray(merged.messageTemplates)) merged.messageTemplates = [];
  const storedTemplateIds = new Set(merged.messageTemplates.map((template) => template.id));
  merged.messageTemplates = [...merged.messageTemplates, ...defaultMessageTemplates.filter((template) => !storedTemplateIds.has(template.id))];
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
