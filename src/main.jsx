import React from "react";
import ReactDOM from "react-dom/client";
import PackPal from "./PackPal.jsx";
import { AuthProvider, useAuth } from "./lib/auth";
import { StoreProvider } from "./lib/store";
import AuthGate from "./components/AuthGate";
import Onboarding from "./components/Onboarding";

function Splash() {
  return (
    <div style={{ minHeight: "100vh", background: "#FDF8F0", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div className="spin" style={{ width: 32, height: 32, borderRadius: "50%",
        border: "3px solid rgba(193,127,89,0.2)", borderTopColor: "#C17F59" }} />
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#9B9490", letterSpacing: ".04em" }}>
        PackPal
      </div>
    </div>
  );
}

function Gate() {
  const { isAuthed, loading, profile, isLocal } = useAuth();

  if (loading) return <Splash />;
  if (!isAuthed) return <AuthGate />;
  // Signed in but the profile row is still loading — avoid flashing the wrong screen.
  if (!isLocal && !profile) return <Splash />;

  const needsOnboarding = !isLocal && profile && profile.onboarded === false;

  return (
    <StoreProvider>
      {needsOnboarding ? <Onboarding /> : <PackPal />}
    </StoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <Gate />
    </AuthProvider>
  </React.StrictMode>
);
