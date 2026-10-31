import { Camera, Plus } from "@/components/icons";
import "./empty-state.css";

/** Decorative prints shared by the event list and the empty album. */
export function EmptyPhotoStack({ waiting = false }: { waiting?: boolean }) {
  return (
    <div className="empty-state-photos" aria-hidden>
      <div className="empty-state-print empty-state-print-left">
        <img src="/pile/sparklers.webp" alt="" draggable={false} />
      </div>
      <div className="empty-state-print empty-state-print-right">
        <img src="/pile/hug.webp" alt="" draggable={false} />
      </div>
      <div className="empty-state-print empty-state-print-front">
        {waiting ? (
          <span className="empty-state-photo-placeholder"><Camera size={36} strokeWidth={1.5} /></span>
        ) : (
          <img src="/pile/toast.webp" alt="" draggable={false} />
        )}
      </div>
      <span className="empty-state-plus"><Plus size={24} strokeWidth={1.75} /></span>
    </div>
  );
}
