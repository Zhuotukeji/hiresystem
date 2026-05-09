import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./ui/AppShell";
import { getToken } from "./api/client";
import { CandidateDetailPage } from "./views/CandidateDetailPage";
import { CandidatesPage } from "./views/CandidatesPage";
import { CompaniesPage } from "./views/CompaniesPage";
import { DashboardPage } from "./views/DashboardPage";
import { InterviewWorkspacePage } from "./views/InterviewWorkspacePage";
import { JobDetailPage } from "./views/JobDetailPage";
import { JobsPage } from "./views/JobsPage";
import { LoginPage } from "./views/LoginPage";
import { ManagerReviewPage } from "./views/ManagerReviewPage";
import { SourcingPage } from "./views/SourcingPage";

function Protected() {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <Protected />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "candidates", element: <CandidatesPage /> },
      { path: "candidates/:id", element: <CandidateDetailPage /> },
      { path: "companies", element: <CompaniesPage /> },
      { path: "jobs", element: <JobsPage /> },
      { path: "jobs/:id", element: <JobDetailPage /> },
      { path: "sourcing", element: <SourcingPage /> },
      { path: "manager-review", element: <ManagerReviewPage /> },
      { path: "interviews/:id", element: <InterviewWorkspacePage /> }
    ]
  }
]);
