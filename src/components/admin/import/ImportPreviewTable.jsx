import { AdminSurface, DataTable, AdminRecordCard, EmptyState, StatusBadge } from "../ui";

function RowStatus({ row }) {
  return <StatusBadge variant={!row.isValid ? "error" : row.warnings?.length ? "warning" : "success"} label={!row.isValid ? "Lỗi" : row.warnings?.length ? "Cảnh báo / Nghi trùng" : "Hợp lệ"} />;
}
function Diagnostics({ row }) {
  return <div className="space-y-2 break-words">
    {row.errors?.length > 0 && <div className="text-red-700"><strong className="text-xs">Lỗi</strong><ul className="list-inside list-disc">{row.errors.map((error, i) => <li key={i}>{error}</li>)}</ul></div>}
    {row.warnings?.length > 0 && <div className="text-amber-800"><strong className="text-xs">Cảnh báo</strong><ul className="list-inside list-disc">{row.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></div>}
    {!row.errors?.length && !row.warnings?.length && <span className="text-[#8993AC]">—</span>}
  </div>;
}
const coordinates = (row) => row.latitude && row.longitude ? `${row.latitude}, ${row.longitude}` : row.rawCoordinates || "—";
const price = (row) => row.estimatedCostMin != null || row.estimatedCostMax != null ? `${row.estimatedCostMin?.toLocaleString()}đ - ${row.estimatedCostMax?.toLocaleString()}đ` : "Miễn phí / -";
const stations = (row) => row.matchedStationNames?.length ? row.matchedStationNames.join(", ") : row.rawStations || "—";

export default function ImportPreviewTable({ preview }) {
  if (!preview || !preview.rows) return null;
  const columns = [
    { key: "rowNumber", header: "Dòng" },
    { key: "status", header: "Trạng thái", render: (row) => <RowStatus row={row} /> },
    { key: "rawName", header: "Tên địa điểm", cellClassName: "min-w-44 font-semibold text-[#0F2148]", render: (row) => row.rawName || "—" },
    { key: "rawAddress", header: "Địa chỉ", cellClassName: "min-w-48 max-w-xs break-words", render: (row) => row.rawAddress || "—" },
    { key: "category", header: "Danh mục", render: (row) => row.normalizedCategory || row.rawCategory || "—" },
    { key: "coordinates", header: "Tọa độ (Lat, Lng)", render: coordinates },
    { key: "price", header: "Giá từ - Giá đến", render: price },
    { key: "stations", header: "Ga Metro", render: stations },
    { key: "diagnostics", header: "Chi tiết lỗi / Cảnh báo", cellClassName: "min-w-64 max-w-sm", render: (row) => <Diagnostics row={row} /> },
  ];
  return <div className="space-y-5">
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {[["Tổng số dòng", preview.totalRows, "text-[#0F2148]"], ["Dòng hợp lệ", preview.validRowsCount, "text-emerald-700"], ["Dòng có lỗi", preview.errorRowsCount, "text-red-700"], ["Dòng nghi trùng / Cảnh báo", preview.warningRowsCount, "text-amber-800"]].map(([label, value, color]) => <AdminSurface key={label} density="compact"><dt className="text-[13px] leading-[18px] text-[#5C6B8A]">{label}</dt><dd className={`mt-2 text-2xl font-bold ${color}`}>{value}</dd></AdminSurface>)}
    </dl>
    <div className="hidden md:block"><DataTable tableLabel="Thẩm định địa điểm nhập" rowKey="rowNumber" rows={preview.rows} columns={columns} emptyState={{ title: "File không có dòng dữ liệu" }} /></div>
    <div className="space-y-3 md:hidden">
      {preview.rows.length === 0 && <EmptyState title="File không có dòng dữ liệu" />}
      {preview.rows.map((row) => <AdminRecordCard key={row.rowNumber} title={row.rawName || "Chưa có tên"} subtitle={`Dòng ${row.rowNumber}`} status={<RowStatus row={row} />}>
        <dl className="space-y-3">
          {[["Địa chỉ", row.rawAddress || "—"], ["Danh mục", row.normalizedCategory || row.rawCategory || "—"], ["Tọa độ", coordinates(row)], ["Khoảng giá", price(row)], ["Ga Metro", stations(row)]].map(([label, value]) => <div key={label}><dt className="text-xs text-[#8993AC]">{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <div className="mt-4 border-t border-[#DCE2EE] pt-3"><Diagnostics row={row} /></div>
      </AdminRecordCard>)}
    </div>
  </div>;
}
