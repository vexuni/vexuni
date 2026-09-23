import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ReposPage } from "./pages/repos";
import { NotFoundPage } from "./pages/notfound";
import { ErrorBoundary, SkeletonRows } from "./components/ui";

// Pages load on demand so the entry chunk stays small: markdown-it and
// highlight.js only download with the pages that render them. Named exports
// are re-exported as default because React.lazy requires it.
const LoginPage = lazy(() =>
  import("./pages/auth").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("./pages/auth").then((m) => ({ default: m.RegisterPage })),
);
const RecoverPage = lazy(() =>
  import("./pages/auth").then((m) => ({ default: m.RecoverPage })),
);
const NewRepoPage = lazy(() =>
  import("./pages/repos").then((m) => ({ default: m.NewRepoPage })),
);
const SearchPage = lazy(() =>
  import("./pages/search").then((m) => ({ default: m.SearchPage })),
);
const NotificationsPage = lazy(() =>
  import("./pages/notifications").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const SpacesPage = lazy(() =>
  import("./pages/spaces").then((m) => ({ default: m.SpacesPage })),
);
const ProfilePage = lazy(() =>
  import("./pages/settings").then((m) => ({ default: m.ProfilePage })),
);
const SecurityPage = lazy(() =>
  import("./pages/settings").then((m) => ({ default: m.SecurityPage })),
);
const TokensPage = lazy(() =>
  import("./pages/settings").then((m) => ({ default: m.TokensPage })),
);
const AdminPage = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.AdminPage })),
);
const RepoLayout = lazy(() =>
  import("./pages/repo/layout").then((m) => ({ default: m.RepoLayout })),
);
const RepoCodePage = lazy(() =>
  import("./pages/repo/code").then((m) => ({ default: m.RepoCodePage })),
);
const RepoFilePage = lazy(() =>
  import("./pages/repo/code").then((m) => ({ default: m.RepoFilePage })),
);
const CommitsPage = lazy(() =>
  import("./pages/repo/commits").then((m) => ({ default: m.CommitsPage })),
);
const CommitDetailPage = lazy(() =>
  import("./pages/repo/commits").then((m) => ({ default: m.CommitDetailPage })),
);
const BranchesPage = lazy(() =>
  import("./pages/repo/branches").then((m) => ({ default: m.BranchesPage })),
);
const TagsPage = lazy(() =>
  import("./pages/repo/branches").then((m) => ({ default: m.TagsPage })),
);
const IssuesPage = lazy(() =>
  import("./pages/repo/issues").then((m) => ({ default: m.IssuesPage })),
);
const NewIssuePage = lazy(() =>
  import("./pages/repo/issues").then((m) => ({ default: m.NewIssuePage })),
);
const IssueDetailPage = lazy(() =>
  import("./pages/repo/issues").then((m) => ({ default: m.IssueDetailPage })),
);
const MergesPage = lazy(() =>
  import("./pages/repo/merges").then((m) => ({ default: m.MergesPage })),
);
const NewMergePage = lazy(() =>
  import("./pages/repo/merges").then((m) => ({ default: m.NewMergePage })),
);
const MergeDetailPage = lazy(() =>
  import("./pages/repo/merges").then((m) => ({ default: m.MergeDetailPage })),
);
const CIPage = lazy(() =>
  import("./pages/repo/ci").then((m) => ({ default: m.CIPage })),
);
const CIRunPage = lazy(() =>
  import("./pages/repo/ci").then((m) => ({ default: m.CIRunPage })),
);
const PackagesPage = lazy(() =>
  import("./pages/repo/packages").then((m) => ({ default: m.PackagesPage })),
);
const RepoSearchPage = lazy(() =>
  import("./pages/repo/search").then((m) => ({ default: m.RepoSearchPage })),
);
const RepoSettingsPage = lazy(() =>
  import("./pages/repo/settings").then((m) => ({
    default: m.RepoSettingsPage,
  })),
);
const ReleasesPage = lazy(() =>
  import("./pages/repo/releases").then((m) => ({ default: m.ReleasesPage })),
);
const FileEditPage = lazy(() =>
  import("./pages/repo/edit").then((m) => ({ default: m.FileEditPage })),
);
const NamespacePage = lazy(() =>
  import("./pages/namespace").then((m) => ({ default: m.NamespacePage })),
);

export default function App() {
  return (
    // Chunk errors (deploy race, offline) must not unmount the whole SPA —
    // the Shell-level boundary only exists once a page has already loaded.
    <ErrorBoundary>
      {/* One boundary around the whole table: a slow chunk shows skeletons
          instead of leaving the previous route's stale page on screen. */}
      <Suspense fallback={<SkeletonRows rows={6} />}>
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
          <Route path="releases" element={<ReleasesPage />} />
          <Route path="edit/*" element={<FileEditPage />} />
          <Route path="new/*" element={<FileEditPage />} />
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
        {/* Single-segment namespaces are last: every literal route above wins
            by score, so /settings, /admin and friends can never hit this page. */}
        <Route path="/:ns" element={<NamespacePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
