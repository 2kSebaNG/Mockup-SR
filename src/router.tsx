import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Show a page's loading skeleton soon after navigating, and long enough not to flicker.
    defaultPendingMs: 150,
    defaultPendingMinMs: 400,
  });

  return router;
};
