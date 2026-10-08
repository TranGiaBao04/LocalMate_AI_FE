import { useState, useEffect } from "react";
import { AdminField } from "./ui";
import { ADMIN_INPUT, ADMIN_SECONDARY_BUTTON } from "./adminStyles";

const HCMC_BOUNDS = {
  minLat: 10.37,
  maxLat: 11.16,
  minLng: 106.36,
  maxLng: 107.03,
};

export default function MapCoordinatePicker({ latitude, longitude, onChange }) {
  const [latInput, setLatInput] = useState(latitude ? String(latitude) : "10.7769");
  const [lngInput, setLngInput] = useState(longitude ? String(longitude) : "106.7009");
  const [coordError, setCoordError] = useState("");

  useEffect(() => {
    if (latitude) setLatInput(String(latitude));
    if (longitude) setLngInput(String(longitude));
  }, [latitude, longitude]);

  const handleInputChange = (newLatStr, newLngStr) => {
    setLatInput(newLatStr);
    setLngInput(newLngStr);

    const lat = parseFloat(newLatStr);
    const lng = parseFloat(newLngStr);

    if (isNaN(lat) || isNaN(lng)) {
      setCoordError("Vĩ độ và Kinh độ phải là số thực hợp lệ.");
      return;
    }

    if (lat < HCMC_BOUNDS.minLat || lat > HCMC_BOUNDS.maxLat) {
      setCoordError(`Vĩ độ (${lat}) nằm ngoài phạm vi TP.HCM [${HCMC_BOUNDS.minLat} - ${HCMC_BOUNDS.maxLat}].`);
      return;
    }

    if (lng < HCMC_BOUNDS.minLng || lng > HCMC_BOUNDS.maxLng) {
      setCoordError(`Kinh độ (${lng}) nằm ngoài phạm vi TP.HCM [${HCMC_BOUNDS.minLng} - ${HCMC_BOUNDS.maxLng}].`);
      return;
    }

    setCoordError("");
    onChange(lat, lng);
  };

  const handleQuickPreset = (presetLat, presetLng) => {
    handleInputChange(String(presetLat), String(presetLng));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField id="place-latitude" label="Vĩ độ (Latitude)" error={coordError}><input id="place-latitude" type="number" step="any" placeholder="10.7769" value={latInput} onChange={(e) => handleInputChange(e.target.value,lngInput)} aria-invalid={Boolean(coordError)} aria-describedby={coordError ? "place-latitude-error" : undefined} className={ADMIN_INPUT} /></AdminField>
        <AdminField id="place-longitude" label="Kinh độ (Longitude)"><input id="place-longitude" type="number" step="any" placeholder="106.7009" value={lngInput} onChange={(e) => handleInputChange(latInput,e.target.value)} aria-invalid={Boolean(coordError)} aria-describedby={coordError ? "place-latitude-error" : undefined} className={ADMIN_INPUT} /></AdminField>
      </div>
      <div className="flex flex-wrap items-center gap-3"><span className="text-xs text-[#5C6B8A]">Gợi ý tọa độ trung tâm:</span><button type="button" onClick={() => handleQuickPreset(10.7769,106.7009)} className={ADMIN_SECONDARY_BUTTON}>Chợ Bến Thành</button><button type="button" onClick={() => handleQuickPreset(10.7885,106.7025)} className={ADMIN_SECONDARY_BUTTON}>Ga Ba Son</button></div>
    </div>
  );
}
