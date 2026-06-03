import { BrowserRouter, Routes, Route } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useStore } from "@/shared/stores/StoreContext";
import { Navbar } from "@/widgets/navbar/ui/Navbar";
import { DashboardPage } from "@/pages/dashboard/ui/DashboardPage";
import { ActivityPage } from "@/pages/activity/ui/ActivityPage";
import { HeartRatePage } from "@/pages/heart-rate/ui/HeartRatePage";
import { BodyPage } from "@/pages/body/ui/BodyPage";
import { StepsPage } from "@/pages/steps/ui/StepsPage";
import { SleepPage } from "@/pages/sleep/ui/SleepPage";
import { ProfilePage } from "@/pages/profile/ui/ProfilePage";
import { ImportPage } from "@/pages/import/ui/ImportPage";
import { FileViewerPage } from "@/pages/file-viewer/ui/FileViewerPage";
import { AuthPage } from "@/pages/auth/ui/AuthPage";
import "./styles/global.scss";

export const App = observer(() => {
  const { auth } = useStore();

  if (!auth.isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/activity/:id" element={<ActivityPage />} />
        <Route path="/heart-rate" element={<HeartRatePage />} />
        <Route path="/body" element={<BodyPage />} />
        <Route path="/steps" element={<StepsPage />} />
        <Route path="/sleep" element={<SleepPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/file-viewer" element={<FileViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
});
