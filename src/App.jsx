import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNavigation, {
  SideNavigation,
} from "./components/layout/BottomNavigation";
import { useAuth } from "./context/AuthContext";
import AdminRoute from "./components/admin/AdminRoute";
import { ADMIN_SECTIONS } from "./components/admin/adminSections";
import { ADMIN_PERMISSIONS } from "./constants";

import WelcomePage from "./pages/auth/WelcomePage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import MetroStationsPage from "./pages/metro/MetroStationsPage";
import HomePage from "./pages/home/HomePage";
import ProfilePage from "./pages/profile/ProfilePage";
import SubscriptionPage from "./pages/subscription/SubscriptionPage";
import PaymentReturnPage from "./pages/subscription/PaymentReturnPage";

import CreateTripPage from "./pages/trip/CreateTripPage";
import AiLoadingPage from "./pages/trip/AiLoadingPage";
import DraftItineraryPage from "./pages/trip/DraftItineraryPage";
import PlacePreviewPage from "./pages/trip/PlacePreviewPage";
import ReplacePlacePage from "./pages/trip/ReplacePlacePage";
import FinalizedItineraryPage from "./pages/trip/FinalizedItineraryPage";
import MyTripsPage from "./pages/trip/MyTripsPage";
import SavedTripDetailPage from "./pages/trip/SavedTripDetailPage";
import CuratedItinerariesPage from "./pages/trip/CuratedItinerariesPage";

const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminStationsPage = lazy(() => import("./pages/admin/AdminStationsPage"));
const AdminPlansPage = lazy(() => import("./pages/admin/AdminPlansPage"));
const AdminTransactionsPage = lazy(() => import("./pages/admin/AdminTransactionsPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminUserDetailPage = lazy(() => import("./pages/admin/AdminUserDetailPage"));
const AdminRolesPage = lazy(() => import("./pages/admin/AdminRolesPage"));
const AdminSectionPlaceholder = lazy(() => import("./pages/admin/AdminSectionPlaceholder"));

// Mục đã có trang thật; mục còn lại hiện placeholder
const ADMIN_PAGES = {
  stations: AdminStationsPage,
  places: AdminPlaceListPage,
  import: ImportStepperPage,
  plans: AdminPlansPage,
  transactions: AdminTransactionsPage,
  settings: AdminSettingsPage,
  users: AdminUsersPage,
  roles: AdminRolesPage,
};

import AdminPlaceListPage from "./pages/admin/AdminPlaceListPage";
import AdminPlaceFormPage from "./pages/admin/AdminPlaceFormPage";
import AdminPlaceDetailPage from "./pages/admin/AdminPlaceDetailPage";
import ImportStepperPage from "./pages/admin/ImportStepperPage";

export default function App() {
  const { pathname } = useLocation();
  const { isLoggedIn, initializing } = useAuth();
  const showAppNav = !pathname.startsWith("/admin") && !["/", "/about", "/login", "/register", "/forgot-password", "/loading", "/payment/success", "/payment/cancel"].includes(
    pathname,
  ) && isLoggedIn;
  const showBottomNav = ["/home", "/trips", "/metro", "/explore", "/profile", "/subscription"].includes(pathname);
  const requireAuth = (element) => {
    if (initializing) return null;
    return isLoggedIn ? element : <Navigate to="/login" replace />;
  };
  // Trang đích: đã đăng nhập thì vào thẳng app, không dựng landing (tránh nháy và gọi API thừa)
  const landingOrHome = () => {
    if (initializing) return null;
    return isLoggedIn ? <Navigate to="/home" replace /> : <WelcomePage />;
  };

  return (
    <>
      {showAppNav && <SideNavigation />}
      <Routes>
        <Route path="/" element={landingOrHome()} />
        <Route path="/about" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/home" element={requireAuth(<HomePage />)} />
        <Route path="/profile" element={requireAuth(<ProfilePage />)} />
        <Route path="/subscription" element={requireAuth(<SubscriptionPage />)} />
        <Route path="/payment/success" element={requireAuth(<PaymentReturnPage mode="success" />)} />
        <Route path="/payment/cancel" element={requireAuth(<PaymentReturnPage mode="cancel" />)} />

        <Route path="/create" element={requireAuth(<CreateTripPage />)} />
        <Route path="/loading" element={requireAuth(<AiLoadingPage />)} />
        <Route path="/draft" element={requireAuth(<DraftItineraryPage />)} />
        <Route path="/place/:placeId" element={requireAuth(<PlacePreviewPage />)} />
        <Route path="/replace/:itemId" element={requireAuth(<ReplacePlacePage />)} />
        <Route path="/finalized" element={requireAuth(<FinalizedItineraryPage />)} />

        <Route path="/trips" element={requireAuth(<MyTripsPage />)} />
        <Route path="/metro" element={requireAuth(<MetroStationsPage />)} />
        <Route path="/explore" element={requireAuth(<CuratedItinerariesPage />)} />
        <Route
          path="/trips/:tripId"
          element={requireAuth(<SavedTripDetailPage />)}
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <AdminLayout />
            </Suspense>
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          {ADMIN_SECTIONS.map((section) => {
            const Page = ADMIN_PAGES[section.path];
            return (
              <Route
                key={section.path}
                path={section.path}
                element={
                  <AdminRoute permissions={section.permissions}>
                    {Page ? <Page /> : <AdminSectionPlaceholder section={section} />}
                  </AdminRoute>
                }
              />
            );
          })}
          <Route
            path="places/create"
            element={
              <AdminRoute permissions={[ADMIN_PERMISSIONS.MANAGE_PLACES]}>
                <AdminPlaceFormPage />
              </AdminRoute>
            }
          />
          <Route
            path="places/edit/:id"
            element={
              <AdminRoute permissions={[ADMIN_PERMISSIONS.MANAGE_PLACES]}>
                <AdminPlaceFormPage />
              </AdminRoute>
            }
          />
          <Route
            path="places/:id"
            element={
              <AdminRoute permissions={[ADMIN_PERMISSIONS.MANAGE_PLACES]}>
                <AdminPlaceDetailPage />
              </AdminRoute>
            }
          />
          <Route
            path="places/import"
            element={
              <AdminRoute permissions={[ADMIN_PERMISSIONS.MANAGE_PLACES]}>
                <ImportStepperPage />
              </AdminRoute>
            }
          />
          <Route
            path="users/:userId"
            element={
              <AdminRoute permissions={[ADMIN_PERMISSIONS.MANAGE_USERS]}>
                <AdminUserDetailPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showAppNav && showBottomNav && <BottomNavigation />}
    </>
  );
}
