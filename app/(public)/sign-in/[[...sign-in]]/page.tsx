import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <div className="card card--padded auth-shell__card">
        <SignIn forceRedirectUrl="/dashboard" />
      </div>
    </main>
  );
}
