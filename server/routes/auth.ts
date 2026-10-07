import { auth } from "../auth";

export const authRoutes = {
  "/api/auth/*": {
    async GET(req: Request) {
      return auth.handler(req);
    },
    async POST(req: Request) {
      return auth.handler(req);
    },
  },
};
