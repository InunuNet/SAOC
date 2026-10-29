#!/usr/bin/env python3
"""Static source checks for backlog-wave-2026-10-28 M3/F2. Usage: check_vendor_admin.py <check-id>.

Run from the project root. Exit 0 = pass, 1 = fail (reason on stderr). No network, no writes.
"""
import re
import sys
from pathlib import Path

ROUTE = Path("app/api/admin/vendors/[id]/resend-payment-link/route.ts")
REG_PAGE = Path("app/(nos)/national-show/vendors/register/page.tsx")
REG_FORM = Path("components/vendors/VendorRegisterForm.tsx")
PAY_FS = Path("components/vendors/VendorPaymentFieldset.tsx")
DECL_FS = Path("components/vendors/VendorDeclarationFieldset.tsx")
APPLY_FORM = Path("components/vendors/VendorApplyForm.tsx")
APPLY_VALID = Path("lib/vendor-apply-form-validation.ts")
DETAIL_PAGE = Path("app/admin/(shell)/vendors/[id]/page.tsx")
DETAIL_COMP = Path("components/admin/VendorSubmissionDetail.tsx")
REVIEW_TABLE = Path("components/admin/VendorReviewTable.tsx")

SECTIONS = [
    "Business", "Contact", "Emergency contact", "Products and permits", "Food", "Booth",
    "Electrical and water", "Gas and heat", "Staff and vehicles", "Storage", "Waste",
    "Marketing and uploads", "Insurance", "Payment", "Declaration and terms", "Original application",
]
LEGACY_FIELDS = [
    "vehicleRegistrations", "staffPerDay", "electricalEquipmentList", "electricalLoad",
    "gasEquipmentType", "boothCount", "hasPublicLiabilityInsurance", "socialMediaHandle",
]


def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def read(path):
    if not path.is_file():
        fail(f"missing file {path}")
    return path.read_text(encoding="utf-8")


def require(text, needle, where):
    if needle not in text:
        fail(f"{where}: expected {needle!r}")


def forbid(text, needle, where):
    if needle in text:
        fail(f"{where}: must not contain {needle!r}")


def c_no_email():
    t = read(ROUTE)
    for n in ("sendVendorStandPaymentNoticeEmail", "deliverConfirmationEmailAfterCommit", "sendEmail"):
        forbid(t, n, str(ROUTE))
    for n in ("getAdminSession", "hasCapability", "mintVendorStandPaymentToken", "paymentUrl", "status: 409", "status: 404"):
        require(t, n, str(ROUTE))


LEGACY_M3 = Path("contracts/checks/vendor-gated-registration-flow-m3/check-approval-mints-payment-link-and-resend.mjs")


def c_legacy_check_updated():
    t = read(LEGACY_M3)
    forbid(t, "resend should send exactly one new email", str(LEGACY_M3))
    seg = t[t.find("const resendFresh"):t.find("vendorStandOrders.set('sub-with-secret', { status: 'paid' })")]
    if "sentStandPaymentEmails.length === 0" not in seg:
        fail("legacy M3 check must now assert the resend sends NO email")
    if "paymentUrl" not in seg:
        fail("legacy M3 check must read the resent token from the response paymentUrl")


def c_prefill():
    page = read(REG_PAGE)
    if not re.search(r"<VendorRegisterForm\b[^>]*initialBusinessName=", page):
        fail("register page must pass initialBusinessName to <VendorRegisterForm>")
    form = read(REG_FORM)
    require(form, "initialBusinessName", str(REG_FORM))
    forbid(form, "searchParams", str(REG_FORM))
    # the prefill must come from the verified application doc, not the ?name= param
    m = re.search(r"<VendorRegisterForm\b[^>]*initialBusinessName=\{([^}]*)\}", page)
    if m and "initialBusinessName" == m.group(1).strip() and "const initialBusinessName =" in page:
        # the query-param variable feeds the code-entry form; it must not feed the gated form
        fail("gated form must not reuse the query-string initialBusinessName variable")


def c_terms_order():
    pay = read(PAY_FS)
    forbid(pay, "termsAccepted", str(PAY_FS))
    decl = read(DECL_FS)
    a = decl.find("<VendorTermsFieldset")
    b = decl.find('fieldKey="termsAccepted"')
    s = decl.find('fieldKey="signatureFullName"')
    if a < 0 or b < 0 or s < 0:
        fail("declaration fieldset must contain Terms prose, termsAccepted and signature block")
    if not (a < b < s):
        fail("order must be Terms prose < termsAccepted checkbox < signature block")
    require(decl, "I confirm I have read and agree to the Vendor Terms & Conditions of the 2027 SAOC National Show.", str(DECL_FS))


def c_apply_labels():
    v = read(APPLY_VALID)
    require(v, "export function humaniseVendorApplyError", str(APPLY_VALID))
    f = read(APPLY_FORM)
    require(f, "humaniseVendorApplyError", str(APPLY_FORM))
    if re.search(r"setFieldErrors\(\s*body\?\.fieldErrors\s*\?\?\s*\[\]\s*\)", f):
        fail("server fieldErrors still set raw")


def c_detail_exists():
    page = read(DETAIL_PAGE)
    comp = read(DETAIL_COMP)
    require(page, "force-dynamic", str(DETAIL_PAGE))
    require(page, "notFound", str(DETAIL_PAGE))
    forbid(page, "'use client'", str(DETAIL_PAGE))
    forbid(comp, "'use client'", str(DETAIL_COMP))
    forbid(comp, "dangerouslySetInnerHTML", str(DETAIL_COMP))
    forbid(comp, "firebase-admin", str(DETAIL_COMP))
    require(read(REVIEW_TABLE), "/admin/vendors/${", str(REVIEW_TABLE))
    require(read(REVIEW_TABLE), "View full registration", str(REVIEW_TABLE))


def c_detail_gate():
    page = read(DETAIL_PAGE)
    for n in ("getAdminSession", "hasCapability", "review-vendor-applications", "redirect("):
        require(page, n, str(DETAIL_PAGE))


def c_detail_serialize():
    page = read(DETAIL_PAGE)
    require(page, "serializeVendorSubmission", str(DETAIL_PAGE))
    require(page, "serializeVendorApplication", str(DETAIL_PAGE))
    require(page, "VENDOR_STAND_ORDERS_COLLECTION", str(DETAIL_PAGE))
    forbid(page, "...doc.data()", str(DETAIL_PAGE))
    forbid(page, "...snapshot.data()", str(DETAIL_PAGE))


def c_detail_readonly():
    for p in (DETAIL_PAGE, DETAIL_COMP):
        t = read(p)
        for n in (".set(", ".update(", ".add(", ".delete(", ".create(", "runTransaction", "batch("):
            forbid(t, n, str(p))


def c_detail_sections():
    comp = read(DETAIL_COMP)
    for s in SECTIONS:
        if not re.search(r"""(['">`])""" + re.escape(s) + r"""(['"<`])""", comp):
            fail(f"section heading {s!r} not found as a literal in {DETAIL_COMP}")


def c_detail_premvp():
    comp = read(DETAIL_COMP)
    for n in LEGACY_FIELDS:
        require(comp, n, str(DETAIL_COMP))
    require(comp, "(legacy)", str(DETAIL_COMP))
    require(comp, "getBoothTypeLabel", str(DETAIL_COMP))
    require(comp, "boothSize", str(DETAIL_COMP))


CHECKS = {
    "no-email": c_no_email,
    "legacy-check": c_legacy_check_updated,
    "prefill": c_prefill,
    "terms-order": c_terms_order,
    "apply-labels": c_apply_labels,
    "detail-exists": c_detail_exists,
    "detail-gate": c_detail_gate,
    "detail-serialize": c_detail_serialize,
    "detail-readonly": c_detail_readonly,
    "detail-sections": c_detail_sections,
    "detail-legacy": c_detail_premvp,
}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in CHECKS:
        print(f"usage: check_vendor_admin.py <{'|'.join(CHECKS)}>", file=sys.stderr)
        sys.exit(2)
    CHECKS[sys.argv[1]]()
    print("PASS")
