const skeleton = "animate-pulse rounded-[8px] bg-[#F4F6FA] motion-reduce:animate-none";

export default function LoadingState({ variant = "section", columns = [], label = "Đang tải dữ liệu..." }) {
  if (variant === "table") return Array.from({ length: 5 }, (_, index) => <tr key={index} aria-hidden="true">{columns.map((column) => <td key={column.key} className="px-4 py-5"><div className={`h-4 ${skeleton}`} /></td>)}</tr>);
  if (variant === "inline") return <div role="status" className="inline-flex items-center gap-2 text-sm leading-[22px] text-[#5C6B8A]"><span aria-hidden="true" className="material-symbols-outlined animate-spin text-[20px] motion-reduce:animate-none">progress_activity</span>{label}</div>;
  return <div role="status" className="space-y-4 p-4"><span className="sr-only">{label}</span><div aria-hidden="true" className={`h-5 w-1/3 ${skeleton}`} /><div aria-hidden="true" className={`h-28 ${skeleton}`} /></div>;
}
