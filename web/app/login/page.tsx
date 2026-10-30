import { GoogleButton } from "@/components/google-button";

export default function Login() {
  return (
    <div className="flex flex-1 flex-col px-6 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <img src="/icon.svg" alt="" className="size-16" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">RollCall</h1>
        <p className="mt-2 text-muted">One shared photo roll for every event.</p>
      </div>
      <GoogleButton />
      <p className="mt-4 text-center text-sm text-muted">
        Everyone signs in, so the album knows who added what.
      </p>
    </div>
  );
}
