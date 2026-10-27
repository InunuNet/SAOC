# Polish wave F7 - targets and scrollbar gutter

- TG-1: standalone links are `inline-flex min-h-11 items-center` (44px) with no change in size,
  colour or underline: society email, phone, website, Facebook and Instagram; home "Full calendar";
  contact info@ link. The `/societies` search input has `min-h-11`. Inline prose links stay exempt.
- SG-1: `html { scrollbar-gutter: stable; }` in `app/globals.css`, which both hosts load.
