import { Suspense } from "react";
import { GuestJoin } from "@/components/guest-join";
import { AlbumSkeleton } from "@/components/skeleton";

async function Content({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  return <GuestJoin invitation={code} />;
}

export default function Join(props: PageProps<"/join/[code]">) {
  return <Suspense fallback={<AlbumSkeleton label="Opening album" />}><Content {...props} /></Suspense>;
}
