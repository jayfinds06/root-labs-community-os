import { desc, sql } from "drizzle-orm";
import { db } from "../db/client";
import { registrations } from "../db/schema";

export const registrationsRoutes = {
  "/api/registrations": {
    async GET() {
      const countResult = db
        .select({ value: sql<number>`count(*)` })
        .from(registrations)
        .get();

      return Response.json({
        count: countResult?.value ?? 0,
      });
    },

    async POST(req: Request) {
      const payload = await req
        .json()
        .then(
          (data) =>
            data as {
              fullName?: string;
              email?: string;
              phone?: string;
              handle?: string;
              discordUsername?: string;
              heardAbout?: string;
              excitement?: string;
            },
        )
        .catch(
          () =>
            ({}) as {
              fullName?: string;
              email?: string;
              phone?: string;
              handle?: string;
              discordUsername?: string;
              heardAbout?: string;
              excitement?: string;
            },
        );

      const { fullName, email, phone, handle, discordUsername, heardAbout, excitement } =
        payload;

      if (
        !fullName ||
        typeof fullName !== "string" ||
        fullName.trim().length < 1
      ) {
        return Response.json(
          { error: "Full name is required." },
          { status: 400 },
        );
      }

      if (
        !email ||
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return Response.json(
          { error: "A valid email address is required." },
          { status: 400 },
        );
      }

      if (!phone || typeof phone !== "string" || phone.trim().length < 1) {
        return Response.json(
          { error: "Phone number is required." },
          { status: 400 },
        );
      }

      // Check for duplicate email
      const existing = db
        .select({ id: registrations.id })
        .from(registrations)
        .where(sql`${registrations.email} = ${email.trim().toLowerCase()}`)
        .get();

      if (existing) {
        return Response.json(
          { error: "This email is already registered for the event." },
          { status: 409 },
        );
      }

      try {
        db.insert(registrations)
          .values({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            handle: handle && typeof handle === "string" ? handle.trim() : null,
            discordUsername:
              discordUsername && typeof discordUsername === "string"
                ? discordUsername.trim()
                : null,
            heardAbout:
              heardAbout && typeof heardAbout === "string"
                ? heardAbout.trim()
                : "",
            excitement:
              excitement && typeof excitement === "string"
                ? excitement.trim()
                : null,
          })
          .run();

        const countResult = db
          .select({ value: sql<number>`count(*)` })
          .from(registrations)
          .get();

        return Response.json({
          ok: true,
          message: "You're registered! Check your inbox for event details.",
          count: countResult?.value ?? 0,
        });
      } catch (err) {
        console.error("Registration error:", err);
        return Response.json(
          { error: "Something went wrong. Please try again." },
          { status: 500 },
        );
      }
    },
  },
};
