"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TopBar } from "@/components/bars";
import { Calendar, Images } from "@/components/icons";
import { ShimmerImage } from "@/components/shimmer-image";
import "./event-header.css";

export function EventHeader({
  title,
  coverUrl,
  previewUrl,
  actions,
  schedule,
  children,
}: {
  title: string;
  coverUrl: string | null;
  previewUrl: string | null;
  actions: ReactNode;
  schedule: ReactNode;
  children: ReactNode;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [compact, setCompact] = useState(false);
  const thumbnail = coverUrl ?? previewUrl;

  useEffect(() => {
    const header = bar.current!;
    const target = heading.current!;
    let observer: IntersectionObserver;
    const observe = () => {
      observer?.disconnect();
      const height = header.getBoundingClientRect().height;
      observer = new IntersectionObserver(([entry]) => {
        setCompact(!entry.isIntersecting && entry.boundingClientRect.top < height);
      }, { rootMargin: `-${height}px 0px 0px 0px` });
      observer.observe(target);
    };
    observe();
    const resize = new ResizeObserver(observe);
    resize.observe(header);
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={bar} className="event-sticky-bar">
        <TopBar
          back="/"
          title={
            <span className="event-bar-identity" data-visible={compact} aria-hidden={!compact}>
              <span className="event-bar-cover">
                {thumbnail ? <ShimmerImage src={thumbnail} alt="" className="size-full" /> : <Images size={22} />}
              </span>
              <span className="event-bar-title" title={title}>{title}</span>
            </span>
          }
          right={actions}
        />
      </div>
      <div className="px-4">
        <div className="event-intro">
          {coverUrl ? <ShimmerImage src={coverUrl} alt="" className="event-cover" /> : null}
          <div className="min-w-0 flex-1">
            <h1 ref={heading} className="text-[26px] leading-tight font-semibold tracking-tight text-balance">{title}</h1>
            <div className="event-date">
              <Calendar size={18} strokeWidth={1.75} />
              {schedule}
            </div>
          </div>
        </div>
        {children}
      </div>
    </>
  );
}
