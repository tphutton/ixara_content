import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <div className="card card--padded auth-shell__card">
        <SignUp forceRedirectUrl="/pending-approval" />
      </div>
    </main>
  );
}
