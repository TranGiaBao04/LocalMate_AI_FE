const padding = { none: "p-0", compact: "p-4", default: "p-5 md:p-6" };
const surfaces = { default: "bg-white", subtle: "bg-[#F8FAFC]", interactive: "bg-white transition-colors hover:border-[#8993AC] focus-within:border-[#2C56A8] motion-reduce:transition-none" };

export default function AdminSurface({ as: Element = "div", density = "default", variant = "default", elevated = false, className = "", children, ...props }) {
  return <Element {...props} className={`min-w-0 rounded-[12px] border border-[#DCE2EE] text-sm leading-[22px] tracking-normal text-[#0F2148] ${surfaces[variant] ?? surfaces.default} ${padding[density] ?? padding.default} ${elevated ? "shadow-sm" : ""} ${className}`}>{children}</Element>;
}
