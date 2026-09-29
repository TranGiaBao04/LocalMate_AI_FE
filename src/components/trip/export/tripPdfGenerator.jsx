import { pdf } from "@react-pdf/renderer";
import TripPdfDocument from "./TripPdfDocument";

export function generateTripPdfBlob(trip) {
  return pdf(<TripPdfDocument trip={trip} />).toBlob();
}
