import { EmptyPhotoStack } from "@/components/empty-photo-stack";

export function EmptyAlbum() {
  return (
    <section className="empty-state empty-album-state" aria-labelledby="empty-album-title">
      <EmptyPhotoStack waiting />
      <h3 id="empty-album-title" className="empty-state-title">Be the first to add a photo</h3>
      <p className="empty-state-description">
        Tap <span className="font-medium text-fg">Add photos &amp; videos</span> to start the album.
        Everyone you invite can add theirs too
      </p>
    </section>
  );
}
