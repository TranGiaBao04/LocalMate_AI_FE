import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";

export default function ImportPreviewTable({ preview }) {
  if (!preview || !preview.rows) return null;

  return (
    <div className="space-y-4">
      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
          <p className="text-[11px] text-gray-500 font-medium">Tổng số dòng</p>
          <p className="text-xl font-bold text-gray-900">{preview.totalRows}</p>
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-[11px] text-emerald-700 font-medium">Dòng hợp lệ</p>
          <p className="text-xl font-bold text-emerald-800">{preview.validRowsCount}</p>
        </div>

        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-[11px] text-red-700 font-medium">Dòng có lỗi</p>
          <p className="text-xl font-bold text-red-800">{preview.errorRowsCount}</p>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-[11px] text-amber-700 font-medium">Dòng nghi trùng / Cảnh báo</p>
          <p className="text-xl font-bold text-amber-800">{preview.warningRowsCount}</p>
        </div>
      </div>

      {/* Preview Data Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
              <tr>
                <th className="p-3">Dòng</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Tên địa điểm</th>
                <th className="p-3">Địa chỉ</th>
                <th className="p-3">Danh mục</th>
                <th className="p-3">Tọa độ (Lat, Lng)</th>
                <th className="p-3">Giá từ - Giá đến</th>
                <th className="p-3">Ga Metro</th>
                <th className="p-3">Chi tiết lỗi / Cảnh báo</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {preview.rows.map((row) => {
                const isError = !row.isValid;
                const isWarning = row.warnings && row.warnings.length > 0;

                let rowBg = "hover:bg-gray-50/80";
                if (isError) rowBg = "bg-red-50/40 hover:bg-red-50/70";
                else if (isWarning) rowBg = "bg-amber-50/40 hover:bg-amber-50/70";

                return (
                  <tr key={row.rowNumber} className={`transition ${rowBg}`}>
                    <td className="p-3 font-bold text-gray-500">{row.rowNumber}</td>

                    <td className="p-3">
                      {isError ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700">
                          <XCircle className="w-3.5 h-3.5" /> Lỗi
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" /> Nghi trùng
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-semibold text-gray-900">{row.rawName || "-"}</td>
                    <td className="p-3 max-w-xs truncate text-gray-600">{row.rawAddress || "-"}</td>
                    <td className="p-3">{row.normalizedCategory || row.rawCategory || "-"}</td>
                    <td className="p-3">
                      {row.latitude && row.longitude ? (
                        <span>{row.latitude}, {row.longitude}</span>
                      ) : (
                        <span className="text-red-500">{row.rawCoordinates || "-"}</span>
                      )}
                    </td>

                    <td className="p-3">
                      {row.estimatedCostMin != null || row.estimatedCostMax != null ? (
                        <span>{row.estimatedCostMin?.toLocaleString()}đ - {row.estimatedCostMax?.toLocaleString()}đ</span>
                      ) : (
                        <span className="text-gray-400">Miễn phí / -</span>
                      )}
                    </td>

                    <td className="p-3">
                      {row.matchedStationNames && row.matchedStationNames.length > 0 ? (
                        <span className="font-medium text-primary">{row.matchedStationNames.join(", ")}</span>
                      ) : (
                        <span className="text-gray-400">{row.rawStations || "-"}</span>
                      )}
                    </td>

                    <td className="p-3">
                      {row.errors && row.errors.length > 0 && (
                        <ul className="list-disc list-inside text-red-600 space-y-0.5">
                          {row.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      )}

                      {row.warnings && row.warnings.length > 0 && (
                        <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                          {row.warnings.map((warn, i) => (
                            <li key={i}>{warn}</li>
                          ))}
                        </ul>
                      )}

                      {!isError && !isWarning && <span className="text-gray-400">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
