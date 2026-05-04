"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { Upload, Bell, Smartphone, Trash2, LogOut, LogIn, ChevronRight } from "lucide-react";

import { PageHeader, SectionLabel } from "@/components/AppShell";

export default function AccountPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const displayName = useMemo(() => {
    if (!isLoaded) return "Loading…";
    if (!isSignedIn || !user) return "Signed out";
    return (
      user.fullName?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.username ||
      "User"
    );
  }, [user, isLoaded, isSignedIn]);

  const email = user?.primaryEmailAddress?.emailAddress ?? "No email available";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ML";

  const handleSignOut = async () => {
    setActionError(null);
    setIsWorking(true);

    try {
      await clerk.signOut();
    } catch {
      setActionError("Could not sign out right now.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="px-12 py-10 max-w-[860px] mx-auto animate-fade-in">
      <PageHeader title="Account" />

      <section className="card-standard p-6 mb-6 flex items-center gap-5">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[hsl(187_100%_50%/0.4)] to-[hsl(187_100%_50%/0.05)] border border-[hsl(187_100%_50%/0.4)] flex items-center justify-center text-[16px] font-medium">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-medium truncate">{displayName}</div>
          <div className="text-[13px] text-meta truncate">{email}</div>
        </div>
        <div className="text-right">
          <div className="label-meta text-cyan/80 px-2.5 h-6 rounded bg-[hsl(187_100%_50%/0.08)] inline-flex items-center">
            {isLoaded ? (isSignedIn ? "Live" : "Signed out") : "Loading"}
          </div>
          <div className="label-meta mt-2">Auth via Clerk</div>
        </div>
      </section>

      <Section title="Plan">
        <Row
          label="Status"
          value={<span className="text-meta">Billing/subscription state is not connected in web yet.</span>}
        />
        <Row label="Renewal" value={<span className="text-meta">Unavailable</span>} />
        <Row label="Usage" value={<span className="text-meta">Unavailable</span>} />
      </Section>

      <Section title="Sync & Import">
        <Row
          label="Auth state"
          value={
            <span className="text-meta">
              {isLoaded ? (isSignedIn ? "Connected" : "Signed out") : "Checking..."}
            </span>
          }
        />
        <Row label="Connected sources" value={<span className="text-meta">Web</span>} />
        <div className="px-5 py-4 border-t hairline">
          <Link href="/import" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-md bg-[hsl(187_100%_50%/0.06)] border border-[hsl(187_100%_50%/0.2)] flex items-center justify-center">
              <Upload className="h-4 w-4 text-cyan" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-medium">Import conversations</div>
              <div className="text-[12.5px] text-meta">Bring in ChatGPT exports and other sources</div>
            </div>
            <ChevronRight className="h-4 w-4 text-meta group-hover:text-cyan transition-colors" strokeWidth={1.5} />
          </Link>
        </div>
      </Section>

      <Section title="Preferences">
        <Toggle icon={Bell} label="Daily check-in reminder" sub="20:00 local" on />
        <Toggle icon={Smartphone} label="Haptic feedback" sub="On capture and check-in" on />
        <Toggle icon={Bell} label="Weekly pattern email" sub="Sundays" />
      </Section>

      <Section title="Data & privacy">
        <Row label="Export all data" value={<span className="label-meta text-meta">Unavailable in web</span>} />
        <Row label="Internal tooling" value={<span className="label-meta text-meta">Context · Memories · References</span>} />
        <Row label="Privacy policy" value={<span className="label-meta text-meta">Unavailable in web</span>} />
        <div className="px-5 py-4 border-t hairline flex items-center gap-3 text-destructive/70">
          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          <div className="text-[13.5px]">Delete account unavailable here</div>
        </div>
      </Section>

      {isLoaded && !isSignedIn ? (
        <button
          onClick={() => void clerk.openSignIn()}
          className="mt-8 inline-flex items-center gap-2 px-4 h-9 rounded-md card-standard hover:border-[hsl(187_100%_50%/0.3)] text-[13px] text-meta hover:text-white"
        >
          <LogIn className="h-4 w-4" strokeWidth={1.5} /> Sign in
        </button>
      ) : (
        <button
          onClick={() => {
            void handleSignOut();
          }}
          disabled={!isLoaded || !isSignedIn || isWorking}
          className="mt-8 inline-flex items-center gap-2 px-4 h-9 rounded-md card-standard hover:border-[hsl(187_100%_50%/0.3)] text-[13px] text-meta hover:text-white disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          {isWorking ? "Signing out..." : "Sign out"}
        </button>
      )}

      {actionError ? <div className="mt-3 text-[12px] text-[hsl(12_80%_64%)]">{actionError}</div> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <SectionLabel>{title}</SectionLabel>
      <div className="card-standard divide-y divide-white/[0.05]">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-5 py-3.5 flex items-center gap-4">
      <div className="text-[13px] text-meta w-44">{label}</div>
      <div className="flex-1 text-[13.5px]">{value}</div>
    </div>
  );
}

function Toggle({
  icon: Icon,
  label,
  sub,
  on,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  sub: string;
  on?: boolean;
}) {
  return (
    <div className="px-5 py-4 flex items-center gap-3">
      <Icon className="h-4 w-4 text-meta" strokeWidth={1.5} />
      <div className="flex-1">
        <div className="text-[13.5px]">{label}</div>
        <div className="label-meta mt-0.5">{sub}</div>
      </div>
      <div className={`h-5 w-9 rounded-full p-0.5 transition-colors ${on ? "bg-cyan" : "bg-white/10"}`}>
        <div className={`h-4 w-4 rounded-full bg-black transition-transform ${on ? "translate-x-4" : ""}`} />
      </div>
    </div>
  );
}
