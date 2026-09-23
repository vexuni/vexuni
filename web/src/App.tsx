import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage, RecoverPage, RegisterPage } from "./pages/auth";
import { NewRepoPage, ReposPage } from "./pages/repos";
import { SearchPage } from "./pages/search";
import { NotificationsPage } from "./pages/notifications";
import { SpacesPage } from "./pages/spaces";
import { ProfilePage, SecurityPage, TokensPage } from "./pages/settings";
import { AdminPage } from "./pages/admin";
import { NotFoundPage } from "./pages/notfound";
import { RepoLayout } from "./pages/repo/layout";
import { RepoCodePage, RepoFilePage } from "./pages/repo/code";
import { CommitDetailPage, CommitsPage } from "./pages/repo/commits";
import { BranchesPage, TagsPage } from "./pages/repo/branches";
import { IssueDetailPage, IssuesPage, NewIssuePage } from "./pages/repo/issues";
import { MergeDetailPage, MergesPage, NewMergePage } from "./pages/repo/merges";
import { CIPage, CIRunPage } from "./pages/repo/ci";
import { PackagesPage } from "./pages/repo/packages";
import { RepoSearchPage } from "./pages/repo/search";
import { RepoSettingsPage } from "./pages/repo/settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/recover" element={<RecoverPage />} />
      <Route path="/" element={<ReposPage />} />
      <Route path="/new" element={<NewRepoPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/spaces" element={<SpacesPage />} />
      {/* A `*` splat route scores below `/:ns/:repo`'s index child, so the
          settings pages must be literal routes or the repo shell swallows them. */}
      <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
      <Route path="/settings/profile" element={<ProfilePage />} />
      <Route path="/settings/security" element={<SecurityPage />} />
      <Route path="/settings/tokens" element={<TokensPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/:ns/:repo" element={<RepoLayout />}>
        <Route index element={<RepoCodePage />} />
        <Route path="tree/*" element={<RepoCodePage />} />
        <Route path="blob/*" element={<RepoFilePage />} />
        <Route path="commits" element={<CommitsPage />} />
        <Route path="commit/:sha" element={<CommitDetailPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="issues" element={<IssuesPage />} />
        <Route path="issues/new" element={<NewIssuePage />} />
        <Route path="issues/:id" element={<IssueDetailPage />} />
        <Route path="merges" element={<MergesPage />} />
        <Route path="merges/new" element={<NewMergePage />} />
        <Route path="merges/:id" element={<MergeDetailPage />} />
        <Route path="ci" element={<CIPage />} />
        <Route path="ci/:id" element={<CIRunPage />} />
        <Route path="packages" element={<PackagesPage />} />
        <Route path="search" element={<RepoSearchPage />} />
        <Route path="settings" element={<RepoSettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
