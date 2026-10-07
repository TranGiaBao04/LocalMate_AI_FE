import { NavLink } from "react-router-dom";
import logo from "../../assets/logo.jpg";
import { ADMIN_ICON_BUTTON } from "./adminStyles";

export default function AdminSidebar({ groups, user, sectionCount, onHome, onUserInterface, onLogout, onNavigate, closeButton }) {
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#DCE2EE] p-5">
        <button type="button" onClick={onHome} aria-label="LocalMate AI, về Tổng quan" className="flex min-w-0 items-center gap-3 rounded-[8px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C56A8]">
          <img src={logo} alt="LocalMate AI" className="h-11 w-11 shrink-0 rounded-[10px] object-cover object-top" />
          <span className="min-w-0">
            <span className="block text-base font-bold leading-6 text-[#0F2148]">LocalMate AI</span>
            <span className="block text-xs leading-[18px] text-[#5C6B8A]">Admin Portal</span>
          </span>
        </button>
        {closeButton}
      </div>
      <nav aria-label="Điều hướng quản trị" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5">
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="mb-2 px-3 text-xs font-semibold uppercase leading-[18px] tracking-normal text-[#5C6B8A]">{group.label}</h2>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C56A8] motion-reduce:transition-none ${isActive ? "bg-[#1D3E82]/[0.08] font-semibold text-[#1D3E82]" : "font-medium text-[#5C6B8A] hover:bg-[#F4F6FA] hover:text-[#0F2148]"}`}>
                      <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[20px]">{item.icon}</span>
                      <span className="min-w-0 break-words">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>
      <div className="shrink-0 space-y-3 border-t border-[#DCE2EE] bg-[#F8FAFC] p-4">
        <button type="button" onClick={onUserInterface} className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[13px] font-medium leading-[18px] text-[#1D3E82] transition-colors hover:bg-[#1D3E82]/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C56A8] motion-reduce:transition-none">
          <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[20px]">storefront</span>Về giao diện người dùng
        </button>
        <div className="px-2 text-xs leading-[18px] text-[#5C6B8A]">
          <p className="break-words">Vai trò: <span className="font-semibold text-violet-700">{user?.role}</span></p>
          {Array.isArray(user?.permissions) && <p>{user.permissions.length} quyền · {sectionCount} khu vực quản trị</p>}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1D3E82]/10 text-sm font-semibold text-[#1D3E82]">{(user?.fullName || "A").trim().charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-[18px] text-[#0F2148]" title={user?.fullName}>{user?.fullName}</p>
            <p className="truncate text-xs leading-[18px] text-[#5C6B8A]" title={user?.email}>{user?.email}</p>
          </div>
          <button type="button" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất" className={ADMIN_ICON_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">logout</span></button>
        </div>
      </div>
    </>
  );
}
