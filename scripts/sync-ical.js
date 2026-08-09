import { syncPropertyIcal } from "../lib/ical.js";
import { listProperties } from "../lib/portfolio.js";

async function run() {
  console.log(`[${new Date().toISOString()}] Starting iCal Sync...`);
  try {
    const properties = await listProperties();
    for (const property of properties) {
      if (property.airbnbIcalUrl || property.bookingIcalUrl) {
        console.log(`Syncing property: ${property.name} (${property.id})...`);
        const results = await syncPropertyIcal(property.id);
        console.log(`Results: ${results.added} added, ${results.updated} updated, ${results.removed} removed.`);
        if (results.errors.length > 0) {
          console.error(`Errors: ${results.errors.join(", ")}`);
        }
      }
    }
  } catch (error) {
    console.error("Sync runner error:", error);
  }
  process.exit(0);
}

run();
