import { ApprovalStatus } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { syncUserAccessRecord } from "@/lib/auth/user-access";

const messages = {
  [ApprovalStatus.pending]: {
    eyebrow: "Approval Required",
    title: "Access request received",
    description:
      "Your account is pending admin review. Once an admin approves your internal workspace access and assigns your role, you’ll be able to enter the platform.",
  },
  [ApprovalStatus.rejected]: {
    eyebrow: "Access Not Approved",
    title: "Your request needs follow-up",
    description:
      "Your current workspace access status is rejected. Contact an internal admin if you believe this needs to be reviewed again.",
  },
  [ApprovalStatus.approved]: {
    eyebrow: "Approved",
    title: "Workspace access granted",
    description: "Your access has been approved. Redirecting you to the dashboard.",
  },
};

export default async function PendingApprovalPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const access = await syncUserAccessRecord(user);

  if (access.approvalStatus === ApprovalStatus.approved) {
    redirect("/dashboard");
  }

  const message = messages[access.approvalStatus];

  return (
    <main className="hero">
      <section className="card card--padded hero__panel">
        <span className="hero__eyebrow">{message.eyebrow}</span>
        <h1>{message.title}</h1>
        <p>{message.description}</p>

        <div className="hero__actions">
          <Link className="button button--primary" href="/sign-in">
            Return to sign in
          </Link>
          <Link className="button button--secondary" href="/">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
