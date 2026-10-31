import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <p className="text-lg font-medium">Nothing here</p>
      <p className="mt-1 text-muted">This event doesn’t exist, or you haven’t joined it yet</p>
      <Link href="/" className="btn btn-secondary mt-6">
        Back to events
      </Link>
    </div>
  );
}
