'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import { parseBio } from '@/lib/view-models/presenter-bio';
import type { PresenterPhoto } from '@/lib/view-models/presenter-photo';
import type { PresenterCardViewModel } from '@/lib/view-models/ticket-card';

// nos-presenter-cards (F1) — presenter cards plus the single full-bio dialog (golden §2, §8).
// Cards level themselves: every bio is clamped to the shortest full bio, and only the cards
// that actually overflow show "Read full bio". Server render and no-JS show every bio in
// full with every button hidden.
const BIO_HEIGHT_VAR = '--bio-h';
const CLIP_TOLERANCE_PX = 1;

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
  eager,
}: {
  photo: PresenterPhoto;
  presenter: PresenterCardViewModel;
  eager?: boolean;
}) {
  return (
    <Image
      src={photo.src}
      width={photo.width}
      height={photo.height}
      alt={`Portrait of ${presenter.name}`}
      loading={eager ? 'eager' : undefined}
      unoptimized
    />
  );
}

export function PresenterGrid({
  presenters,
  dialogIdBase,
}: {
  presenters: PresenterCardViewModel[];
  dialogIdBase: string;
}) {
  const gridRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetBodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [clippedIds, setClippedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const level = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.style.removeProperty(BIO_HEIGHT_VAR);
    const clips = Array.from(grid.querySelectorAll<HTMLElement>('.pc-clip'));
    if (clips.length === 0) return;
    // A presenter published without a bio has an empty clip; it must not set the clamp.
    const filled = clips.map((clip) => clip.scrollHeight).filter((height) => height > 0);
    const bioHeight = filled.length > 0 ? Math.min(...filled) : null;
    if (bioHeight !== null) grid.style.setProperty(BIO_HEIGHT_VAR, `${bioHeight}px`);
    const next = presenters
      .filter(
        (_, index) =>
          bioHeight !== null && clips[index].scrollHeight > bioHeight + CLIP_TOLERANCE_PX,
      )
      .map((presenter) => presenter.id);
    setClippedIds((prev) =>
      prev.length === next.length && prev.every((id, index) => id === next[index]) ? prev : next,
    );
  }, [presenters]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(level);
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
  }, [level]);

  // Opens once the active presenter's content is in the dialog.
  useEffect(() => {
    if (activeId === null) return;
    sheetBodyRef.current?.scrollTo(0, 0);
    dialogRef.current?.showModal();
    closeRef.current?.focus();
  }, [activeId]);

  const active = presenters.find((presenter) => presenter.id === activeId) ?? null;
  const dialogTitleId = `${dialogIdBase}-dialog-title`;

  function openBio(id: string, opener: HTMLButtonElement) {
    openerRef.current = opener;
    setActiveId(id);
  }

  function handleDialogClose() {
    setActiveId(null);
    openerRef.current?.focus();
  }

  return (
    <>
      <ul ref={gridRef} className="pc-grid">
        {presenters.map((presenter) => (
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
              <div className={`pc-clip${clippedIds.includes(presenter.id) ? ' is-clipped' : ''}`}>
                <PresenterBody bio={presenter.bioExcerpt} />
              </div>
            </div>
            <div className="pc-foot">
              <button
                type="button"
                className="pc-more"
                aria-haspopup="dialog"
                hidden={!clippedIds.includes(presenter.id)}
                onClick={(event) => openBio(presenter.id, event.currentTarget)}
              >
                Read full bio<span className="sr-only"> of {presenter.name}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        className="pc-modal"
        aria-labelledby={dialogTitleId}
        onClose={handleDialogClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        {active ? (
          <div className="pc-sheet-inner">
            <div className="pc-sheet-head">
              <div className="pc-sheet-face">
                {active.photo ? <PresenterImage photo={active.photo} presenter={active} eager /> : null}
              </div>
              <div>
                <h2 id={dialogTitleId} className="pc-sheet-title">
                  {active.name}
                </h2>
                {active.role ? <p className="pc-role">{active.role}</p> : null}
              </div>
              <button
                ref={closeRef}
                type="button"
                className="pc-sheet-close"
                onClick={() => dialogRef.current?.close()}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div ref={sheetBodyRef} className="pc-sheet-body">
              <PresenterBody bio={active.bioExcerpt} />
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
