import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNavigation, {
  SideNavigation,
} from "./components/layout/BottomNavigation";
import { useAuth } from "./context/AuthContext";
import AdminRoute from "./components/admin/AdminRoute";
import { ADMIN_SECTIONS } from "./components/admin/adminSections";

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

const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminSectionPlaceholder = lazy(() => import("./pages/admin/AdminSectionPlaceholder"));

export default function App() {
  const { pathname } = useLocation();
  const { isLoggedIn, initializing } = useAuth();
  const showAppNav = !pathname.startsWith("/admin") && !["/", "/login", "/register", "/forgot-password", "/loading", "/payment/success", "/payment/cancel"].includes(
    pathname,
  ) && isLoggedIn;
  const showBottomNav = ["/home", "/trips", "/profile"].includes(pathname);
  const requireAuth = (element) => {
    if (initializing) return null;
    return isLoggedIn ? element : <Navigate to="/login" replace />;
  };

  return (
    <>
      {showAppNav && <SideNavigation />}
      <Routes>
        <Route path="/" element={<WelcomePage />} />
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
          {ADMIN_SECTIONS.map((section) => (
            <Route
              key={section.path}
              path={section.path}
              element={
                <AdminRoute permissions={section.permissions}>
                  <AdminSectionPlaceholder section={section} />
                </AdminRoute>
              }
            />
          ))}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showAppNav && showBottomNav && <BottomNavigation />}
    </>
  );
}
