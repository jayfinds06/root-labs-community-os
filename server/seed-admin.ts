/**
 * Seed an admin user for the dashboard.
 *
 * Usage:
 *   bun run server/seed-admin.ts
 *
 * Environment variables:
 *   ADMIN_EMAIL    - required
 *   ADMIN_PASSWORD - required, at least 12 characters
 *   ADMIN_NAME     - defaults to Admin
 */
import { auth } from "./auth";
import { db } from "./db/client";
import { user } from "./db/schema";
import { eq } from "drizzle-orm";

const email = process.env.ADMIN_EMAIL?.trim();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? "Admin";

const main = async () => {
  if (!email || !password || password.length < 12) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) before seeding an admin.");
  }

  // Check if user already exists
  const existing = db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .get();

  if (existing) {
    // Just update role to admin
    db.update(user).set({ role: "admin" }).where(eq(user.id, existing.id)).run();
    console.log("User already exists, updated role to admin.");
  } else {
    // Create user via better-auth signup
    await auth.api.signUpEmail({
      body: { email, password, name },
      headers: new Headers(),
    });

    // Set role to admin directly in DB
    db.update(user).set({ role: "admin" }).where(eq(user.email, email)).run();
    console.log("Admin user created.");
  }

  console.log(`  Email:    ${email}`);
  console.log(`  Role:     admin`);
  console.log(`\nYou can now log in at /dashboard`);
};

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
