Adversarially review the working-tree diff for HD-1b (F3), branch fix/nav-focus-underline. Spec: goldens/hd1-header-parity.md section "HD-1b" and
header-geometry.json (rules with feature f3). Hunt for: the container token changed but a public SAOC page still on the old 1216 box (look for any remaining
max-w-[1280px] or px-8 container in public components); a per-page edit where the token should carry it; the token value not equal to NOS (--nc-wide, --nc-gutter);
an unrelated layout change (padding, hero, section spacing) hidden in a class swap; admin pages touched; horizontal overflow at 390; a bare hex colour. First line of output must be PASS or FAIL, then findings.
