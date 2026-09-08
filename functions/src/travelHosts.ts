/** Only these hostnames are contacted, linked, or cited as holiday price sources. */
export const LEGITIMATE_TRAVEL_HOSTS = [
  "www.britishairways.com",
  "holidays.ba.com",
  "www.jet2holidays.com",
  "www.jet2.com",
  "www.tui.co.uk",
  "www.firstchoice.co.uk",
  "www.easyjet.com",
  "www.loveholidays.com",
  "www.onthebeach.co.uk",
  "www.lastminute.com",
  "www.expedia.co.uk",
  "www.booking.com",
  "www.skyscanner.net",
  "www.kayak.co.uk",
  "www.trailfinders.com",
  "www.kuoni.co.uk",
  "www.virginatlantic.com",
  "www.virginholidays.co.uk",
  "www.ryanair.com",
  "www.travelrepublic.co.uk",
  "www.secretescapes.com",
  "www.saga.co.uk",
] as const;

export function isAllowlistedTravelUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return LEGITIMATE_TRAVEL_HOSTS.some((h) => host === h || host.endsWith(`.${h.replace(/^www\./, "")}`));
  } catch {
    return false;
  }
}
