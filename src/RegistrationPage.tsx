import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import logoSrc from "../public/logo.webp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormStatus = "idle" | "submitting" | "success" | "error";

type FormValues = {
  fullName: string;
  email: string;
  phone: string;
  handle: string;
  discordUsername: string;
  heardAbout: string;
  excitement: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  fullName: "",
  email: "",
  phone: "",
  handle: "",
  discordUsername: "",
  heardAbout: "",
  excitement: "",
};

const fieldClassName =
  "border-border/70 bg-background/55 hover:border-primary/20 focus-visible:bg-background";

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validate = (values: FormValues): FormErrors => {
  const errors: FormErrors = {};

  if (!values.fullName.trim()) errors.fullName = "Name is required";
  if (!values.email.trim()) {
    errors.email = "Email is required";
  } else if (!isValidEmail(values.email.trim())) {
    errors.email = "Enter a valid email";
  }
  if (!values.phone.trim()) errors.phone = "Phone is required";
  if (!values.handle.trim()) errors.handle = "TikTok handle is required";
  if (!values.excitement.trim()) errors.excitement = "This field is required";

  return errors;
};

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  ) : (
    <div className="h-5" />
  );

const RegistrationPage = () => {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [submitError, setSubmitError] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("submitting");
    setSubmitError("");

    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          handle: values.handle.trim(),
          discordUsername: values.discordUsername.trim(),
          phone: values.phone.trim(),
          heardAbout: values.heardAbout.trim(),
          excitement: values.excitement.trim(),
        }),
      });

      const payload = await response.json();

      if (response.status === 409) {
        setAlreadyRegistered(true);
        setStatus("success");
        setValues(initialValues);
        setErrors({});
        return;
      }

      if (!response.ok) {
        setStatus("error");
        setSubmitError(payload.error ?? "Something went wrong.");
        return;
      }

      setAlreadyRegistered(false);
      setStatus("success");
      setValues(initialValues);
      setErrors({});
    } catch {
      setStatus("error");
      setSubmitError("Network error. Please try again.");
    }
  };

  const setField = (field: keyof FormValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,theme(colors.primary/.14),transparent_62%)]" />

      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <Card className="w-full overflow-hidden rounded-[28px] border-border/70 bg-card/92 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur">
          <CardHeader className="space-y-5 border-b border-border/60 px-6 pb-8 pt-6 sm:px-8">
            <a
              href="/dashboard"
              className="w-fit text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Back to dashboard
            </a>

            <div className="space-y-4">
              <img src={logoSrc} alt="Root Labs" className="h-10 w-auto" />
              <Badge className="w-fit rounded-full px-3 py-1 text-primary">
                Replay request
              </Badge>
              <div className="space-y-2">
                <CardTitle className="font-display text-4xl tracking-[-0.05em] sm:text-5xl">
                  Request replay access.
                </CardTitle>
                <CardDescription className="max-w-2xl text-base leading-7">
                  The Root Labs launch happened on February 28, 2026. This form
                  is only for replay access and follow-up.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
            {status === "success" ? (
              <div className="space-y-6 rounded-[24px] border border-primary/20 bg-primary/10 p-6 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
                      Request saved
                    </p>
                    <h2 className="font-display text-3xl tracking-[-0.03em] text-foreground">
                      {alreadyRegistered
                        ? "You're already on the replay list"
                        : "We've saved your replay request"}
                    </h2>
                  </div>
                </div>

                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  {alreadyRegistered
                    ? "We already have your details on file, so there is nothing else you need to submit."
                    : "We'll follow up with replay information and any relevant post-event access details."}
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="outline" className="sm:w-auto">
                    <a href="/dashboard">
                      Return to dashboard
                      <ArrowRight className="size-4" />
                    </a>
                  </Button>
                  <Button asChild variant="ghost" className="sm:w-auto">
                    <a href="/">
                      Back to ops home
                      <ArrowRight className="size-4" />
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <form className="grid gap-6" onSubmit={onSubmit} noValidate>
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    autoComplete="name"
                    value={values.fullName}
                    onChange={(e) => setField("fullName", e.target.value)}
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={errors.fullName ? "fullName-error" : undefined}
                    className={fieldClassName}
                  />
                  <FieldError id="fullName-error" message={errors.fullName} />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={values.email}
                      onChange={(e) => setField("email", e.target.value)}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      className={fieldClassName}
                    />
                    <FieldError id="email-error" message={errors.email} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      autoComplete="tel"
                      value={values.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? "phone-error" : undefined}
                      className={fieldClassName}
                    />
                    <FieldError id="phone-error" message={errors.phone} />
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="handle">TikTok handle</Label>
                    <Input
                      id="handle"
                      value={values.handle}
                      onChange={(e) => setField("handle", e.target.value)}
                      aria-invalid={Boolean(errors.handle)}
                      aria-describedby={errors.handle ? "handle-error" : undefined}
                      className={fieldClassName}
                    />
                    <FieldError id="handle-error" message={errors.handle} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="discordUsername">Discord username</Label>
                    <Input
                      id="discordUsername"
                      value={values.discordUsername}
                      onChange={(e) => setField("discordUsername", e.target.value)}
                      className={fieldClassName}
                    />
                    <FieldError id="discordUsername-error" />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="heardAbout">How did you hear about the archive?</Label>
                  <Input
                    id="heardAbout"
                    value={values.heardAbout}
                    onChange={(e) => setField("heardAbout", e.target.value)}
                    className={fieldClassName}
                  />
                  <FieldError id="heardAbout-error" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="excitement">What are you hoping to get from the replay?</Label>
                  <Textarea
                    id="excitement"
                    rows={5}
                    value={values.excitement}
                    onChange={(e) => setField("excitement", e.target.value)}
                    aria-invalid={Boolean(errors.excitement)}
                    aria-describedby={errors.excitement ? "excitement-error" : undefined}
                    className={fieldClassName}
                  />
                  <FieldError id="excitement-error" message={errors.excitement} />
                </div>

                {submitError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {submitError}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    We only collect what is needed for replay follow-up.
                  </p>
                  <Button type="submit" size="lg" disabled={status === "submitting"} className="min-w-48">
                    {status === "submitting" ? "Submitting..." : "Request replay"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default RegistrationPage;
