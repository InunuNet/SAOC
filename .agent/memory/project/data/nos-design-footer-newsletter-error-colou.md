# nos-design-footer-newsletter-error-colou

**NOS Design: footer newsletter error colours** (Gemini, #212 review; pre-existing on main). On NOS the footer signup's email error (`NosFooter.tsx` errorClassName `nf-text`) has no icon or error border, and the topics alert in `NewsletterSignup.tsx` uses `border-error` (#9b2c2c) plus an uncoloured ⚠︎ on the royal #211A57 background, where SAOC uses `--status-error-on-dark`. Needs a NOS on-dark error token ruling from NOS Design before code.
