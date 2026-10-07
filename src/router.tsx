import {
  Outlet,
  createRootRoute,
  createRoute,
createRouter,
createHashHistory,
} from "@tanstack/react-router";
import {
  normalizeDashboardSearch,
  normalizeSentimentSearch,
} from "./admin-route-search";
import HomePage from "./HomePage";
import AdminDashboard from "./AdminDashboard";
import RegistrationPage from "./RegistrationPage";

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen">
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  validateSearch: normalizeDashboardSearch,
  component: () => <AdminDashboard workspace="dashboard" />,
});

const sentimentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard/sentiment",
  validateSearch: normalizeSentimentSearch,
  component: () => <AdminDashboard workspace="sentiment" />,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegistrationPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  sentimentRoute,
  registerRoute,
]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
