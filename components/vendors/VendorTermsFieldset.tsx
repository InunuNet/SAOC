// M2 F20 (vendor-gated-registration-flow) -- the 14-clause prose Terms & Conditions block,
// verbatim from docs/leeann-source/2027-vendor-registration-form_2026-08-26.md's "TERMS AND
// CONDITIONS" section. Extracted out of VendorDeclarationFieldset.tsx to keep that component
// under this project's 150-line convention -- rendered inline within the "Declaration & Terms"
// section, no own <h2>.
export function VendorTermsFieldset() {
  return (
    <div className="space-y-3 border border-rule-soft bg-parchment p-4 text-[13.5px] leading-relaxed text-ink/80">
      <p>
        By completing and submitting this Vendor Registration Form, I/We confirm that I/We have
        read, understood and agree to the following Terms and Conditions governing
        participation in the 2027 SAOC National Show.
      </p>

      <p><strong>Registration and Consent.</strong> Completion and submission of this registration form constitutes consent for the organisers to collect and process the information provided for the purposes of administering the vendor registration, payment, communication, security and general management of the 2027 SAOC National Show.</p>

      <p><strong>Voluntary Agreement.</strong> I/We enter into this agreement voluntarily and confirm that the information provided in this registration form is true and correct to the best of my/our knowledge.</p>

      <p><strong>Vendor Allocation.</strong> I/We understand that submission of a registration form does not guarantee a particular booth or location. Final booth allocation will be determined by the Show Organising Committee, taking into consideration the overall layout, operational requirements, product categories and best interests of the show.</p>

      <p><strong>Products and Activities.</strong> The Show Organising Committee reserves the right to refuse, restrict or require the removal of any product, equipment, display or activity that is considered unsafe, unlawful, inappropriate or inconsistent with the purpose, standards or requirements of the show. Vendors may only sell or promote products and services that have been declared on their registration form, unless prior approval has been obtained from the Show Organising Committee.</p>

      <p><strong>Vendor Responsibility.</strong> I/We accept full responsibility for my/our stock, equipment, displays, staff, contractors and personal belongings for the duration of the event. The organisers will not be responsible for loss of, theft of or damage to vendor stock, equipment or personal belongings.</p>

      <p><strong>Setup, Trading and Breakdown.</strong> I/We agree to comply with the setup, trading and breakdown times communicated by the Show Organising Committee. Vendors must ensure that their booth is fully set up and ready for trading by the designated opening time and may not dismantle or remove their displays before the authorised closing time without prior approval from the organisers.</p>

      <p><strong>Payment and Confirmation.</strong> A vendor booking will only be confirmed once the completed registration requirements have been received and full payment has been received by the organisers. The organisers reserve the right to release an unpaid or incomplete booking if payment is not received by the specified deadline.</p>

      {/* M2 golden README "The two flagged contradictions" (1): the WRITTEN document says
          90 days; Lee-Ann's voice note named a shorter window (roughly eight weeks).
          Implemented per the written document per the mission's hard constraint -- flagged
          here, not silently resolved. A36 enforces both the 90-day sentence's presence and
          that the voice note's contradicting figure never appears anywhere in
          components/vendors/. */}
      <p>
        <strong>Cancellation and Refunds.</strong> All vendor registrations and payments must be
        finalised no later than 90 days before the opening of the show. Cancellations received
        within 90 days of the show will not qualify for a refund. Any cancellation received more
        than 90 days before the show will be considered in accordance with the cancellation and
        refund policy of the Show Organising Committee.
      </p>

      <p><strong>Compliance and Safety.</strong> I/We agree to comply with all reasonable instructions issued by the Show Organising Committee, venue management, security personnel and authorised event staff. I/We further agree to comply with all applicable health and safety requirements, venue regulations, municipal requirements and South African legislation relevant to my/our participation.</p>

      <p><strong>Non-Compliance.</strong> The Show Organising Committee reserves the right to refuse participation or require a vendor to cease trading or remove a product, display or activity if the vendor fails to comply with these Terms and Conditions or with reasonable instructions issued by the organisers. In such circumstances, no refund will necessarily be payable.</p>

      <p><strong>Insurance and Liability.</strong> Vendors are responsible for arranging their own insurance cover for stock, equipment, public liability, employees and any other risks associated with their participation, where appropriate. Participation in the show is at the vendor&apos;s own risk, subject to any liability that cannot lawfully be excluded under South African law.</p>

      <p><strong>Photography and Promotion.</strong> I/We acknowledge that photography and video recording may take place during the show for promotional, publicity, reporting and archival purposes. By participating in the show, I/We acknowledge that my/our booth, products and representatives may appear incidentally in such material.</p>

      <p><strong>Protection of Personal Information.</strong> I/We consent to the collection, storage and processing of the personal information provided in this form for purposes relating to vendor registration, payment administration, communication, security, event management and other legitimate requirements of the 2027 SAOC National Show. The organisers will process personal information in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA) and other applicable South African privacy legislation.</p>

      <p><strong>Acceptance of Terms.</strong> By submitting this registration form, I/We confirm that I/We have read and understood these Terms and Conditions and agree to be bound by them. Submission of the completed registration form constitutes acceptance of these Terms and Conditions.</p>
    </div>
  );
}
