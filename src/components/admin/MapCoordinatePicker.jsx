import { useState, useEffect } from "react";
import { MapPin, Navigation, AlertCircle } from "lucide-react";

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
    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <MapPin className="w-4 h-4 text-teal-600" />
          <span>Tọa độ địa lý TP.HCM (Latitude / Longitude) <span className="text-red-500">*</span></span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            Vĩ độ (Latitude)
          </label>
          <input
            type="number"
            step="any"
            placeholder="10.7769"
            value={latInput}
            onChange={(e) => handleInputChange(e.target.value, lngInput)}
            className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            Kinh độ (Longitude)
          </label>
          <input
            type="number"
            step="any"
            placeholder="106.7009"
            value={lngInput}
            onChange={(e) => handleInputChange(latInput, e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {coordError && (
        <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{coordError}</span>
        </div>
      )}

      {/* Quick presets for admin testing */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[11px] text-gray-400">Gợi ý tọa độ trung tâm:</span>
        <button
          type="button"
          onClick={() => handleQuickPreset(10.7769, 106.7009)}
          className="px-2 py-0.5 text-[11px] bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-600"
        >
          Chợ Bến Thành
        </button>
        <button
          type="button"
          onClick={() => handleQuickPreset(10.7885, 106.7025)}
          className="px-2 py-0.5 text-[11px] bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-600"
        >
          Ga Ba Son
        </button>
      </div>
    </div>
  );
}
