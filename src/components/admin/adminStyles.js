// Class nút dùng chung ở phần đầu trang admin
export const ADMIN_PRIMARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#2C56A8] px-4 py-2.5 text-sm font-semibold leading-5 text-white transition-colors hover:bg-[#1D3E82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C56A8] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";
export const ADMIN_SECONDARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-[#DCE2EE] bg-white px-4 py-2.5 text-sm font-semibold leading-5 text-[#0F2148] transition-colors hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C56A8] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

export const ADMIN_ICON_BUTTON =
  "grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-[#5C6B8A] transition-colors hover:bg-[#F4F6FA] hover:text-[#1D3E82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C56A8] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

export const ADMIN_TERTIARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-3 py-2 text-sm font-semibold leading-5 text-[#5C6B8A] hover:bg-[#F4F6FA] hover:text-[#1D3E82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C56A8] disabled:cursor-not-allowed disabled:opacity-50";
export const ADMIN_DESTRUCTIVE_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-red-600 px-4 py-2.5 text-sm font-semibold leading-5 text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50";
export const ADMIN_INPUT =
  "h-11 w-full min-w-0 rounded-[12px] border border-[#DCE2EE] bg-white px-3 text-sm leading-5 text-[#0F2148] placeholder:text-[#8993AC] focus:border-[#2C56A8] focus:outline-none focus:ring-2 focus:ring-[#2C56A8]/20 disabled:cursor-not-allowed disabled:bg-[#F4F6FA] disabled:text-[#8993AC] aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-200";
export const ADMIN_SELECT = ADMIN_INPUT;
export const ADMIN_DENSE_INPUT = ADMIN_INPUT + " md:h-10";
