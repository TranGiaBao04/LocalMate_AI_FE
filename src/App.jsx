import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNavigation, {
  SideNavigation,
} from "./components/layout/BottomNavigation";
import { useAuth } from "./context/AuthContext";

import WelcomePage from "./pages/auth/WelcomePage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import HomePage from "./pages/home/HomePage";
import ProfilePage from "./pages/profile/ProfilePage";

import CreateTripPage from "./pages/trip/CreateTripPage";
import AiLoadingPage from "./pages/trip/AiLoadingPage";
import DraftItineraryPage from "./pages/trip/DraftItineraryPage";
import PlacePreviewPage from "./pages/trip/PlacePreviewPage";
import ReplacePlacePage from "./pages/trip/ReplacePlacePage";
import FinalizedItineraryPage from "./pages/trip/FinalizedItineraryPage";
import MyTripsPage from "./pages/trip/MyTripsPage";
import SavedTripDetailPage from "./pages/trip/SavedTripDetailPage";

export default function App() {
  const { pathname } = useLocation();
  const { isLoggedIn } = useAuth();
  const showAppNav = !["/", "/login", "/register", "/loading"].includes(
    pathname,
  ) && isLoggedIn;
  const showBottomNav = ["/home", "/trips", "/profile"].includes(pathname);
  const requireAuth = (element) =>
    isLoggedIn ? element : <Navigate to="/login" replace />;

  return (
    <>
      {showAppNav && <SideNavigation />}
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/home" element={requireAuth(<HomePage />)} />
        <Route path="/profile" element={requireAuth(<ProfilePage />)} />

        <Route path="/create" element={requireAuth(<CreateTripPage />)} />
        <Route path="/loading" element={requireAuth(<AiLoadingPage />)} />
        <Route path="/draft" element={requireAuth(<DraftItineraryPage />)} />
        <Route path="/place/:placeId" element={requireAuth(<PlacePreviewPage />)} />
        <Route path="/replace/:itemId" element={requireAuth(<ReplacePlacePage />)} />
        <Route path="/finalized" element={requireAuth(<FinalizedItineraryPage />)} />

        <Route path="/trips" element={requireAuth(<MyTripsPage />)} />
        <Route
          path="/trips/:tripId"
          element={requireAuth(<SavedTripDetailPage />)}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showAppNav && showBottomNav && <BottomNavigation />}
    </>
  );
}
