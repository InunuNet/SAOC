'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { parseBio } from '@/lib/view-models/presenter-bio';
import type { PresenterPhoto } from '@/lib/view-models/presenter-photo';
import type { PresenterCardViewModel } from '@/lib/view-models/ticket-card';

// nos-presenter-cards (F1) / nos-critique-r3 (R39) — presenter cards with an inline bio
// disclosure. Each bio is clamped to MAX_LINES lines once the grid has mounted, and only the
// cards that overflow show "Read full bio", a button whose aria-expanded flips the clamp.
// Server render and no-JS show every bio in full with every button hidden.
const MAX_LINES = 4;
const OVERFLOW_TOLERANCE_PX = 1;

// False on the server and during hydration, true once mounted: the clamp is progressive
// enhancement, so the server render and no-JS keep every bio in full.
function subscribeNever() {
  return () => {};
}

function useMounted() {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

function PresenterBody({ bio }: { bio: string | null }) {
  return (
    <div className="pc-body">
      {parseBio(bio).map((block, index) =>
        block.kind === 'p' ? (
          <p key={index}>{block.text}</p>
        ) : (
          <ul key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function PresenterImage({
  photo,
  presenter,
}: {
  photo: PresenterPhoto;
  presenter: PresenterCardViewModel;
}) {
  return (
    <Image
      src={photo.src}
      width={photo.width}
      height={photo.height}
      alt={`Portrait of ${presenter.name}`}
      unoptimized
    />
  );
}

function PresenterClip({
  id,
  bio,
  overflowing,
  open,
}: {
  id: string;
  bio: string | null;
  overflowing: boolean;
  open: boolean;
}) {
  return (
    <div id={id} className={`pc-clip${overflowing ? ' is-clipped' : ''}${open ? ' is-open' : ''}`}>
      <PresenterBody bio={bio} />
    </div>
  );
}

export function PresenterGrid({
  presenters,
  idBase,
}: {
  presenters: PresenterCardViewModel[];
  idBase: string;
}) {
  const clampReady = useMounted();
  const [overflowIds, setOverflowIds] = useState<string[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const gridRef = useRef<HTMLUListElement>(null);

  const measure = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const clips = Array.from(grid.querySelectorAll<HTMLElement>('.pc-clip'));
    const next = presenters
      .filter((_, index) => {
        const clip = clips[index];
        const block = clip?.querySelector<HTMLElement>('p,li');
        if (!clip || !block) return false;
        const lineHeightPx = parseFloat(getComputedStyle(block).lineHeight);
        return clip.scrollHeight > MAX_LINES * lineHeightPx + OVERFLOW_TOLERANCE_PX;
      })
      .map((presenter) => presenter.id);
    setOverflowIds((prev) =>
      prev.length === next.length && prev.every((id, index) => id === next[index]) ? prev : next,
    );
  }, [presenters]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    // Text-only zoom or a font swap can rewrap a bio without resizing the grid.
    grid.querySelectorAll('.pc-body').forEach((body) => observer.observe(body));
    document.fonts.ready.then(schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [measure]);

  function toggle(id: string) {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((openId) => openId !== id) : [...prev, id]));
  }

  return (
    <ul ref={gridRef} className="pc-grid" data-clamp={clampReady ? '' : undefined}>
      {presenters.map((presenter) => {
        const bioId = `${idBase}-bio-${presenter.id}`;
        const isOpen = openIds.includes(presenter.id);
        const isOverflowing = overflowIds.includes(presenter.id);
        return (
          <li key={presenter.id} className="pc-card">
            <div className="pc-head">
              <figure className="pc-photo" aria-hidden={presenter.photo ? undefined : true}>
                {presenter.photo ? (
                  <PresenterImage photo={presenter.photo} presenter={presenter} />
                ) : null}
              </figure>
              <div className="pc-id">
                <h3 className="pc-name">{presenter.name}</h3>
                {presenter.role ? <p className="pc-role">{presenter.role}</p> : null}
              </div>
            </div>
            <div className="pc-bio">
              <PresenterClip
                id={bioId}
                bio={presenter.bioExcerpt}
                overflowing={isOverflowing}
                open={isOpen}
              />
            </div>
            <div className="pc-foot">
              <button
                type="button"
                className="pc-more"
                aria-expanded={isOpen}
                aria-controls={bioId}
                hidden={!isOverflowing}
                onClick={() => toggle(presenter.id)}
              >
                Read full bio<span className="sr-only"> of {presenter.name}</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
