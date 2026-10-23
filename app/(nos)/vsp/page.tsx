import VendorStandPaymentStatusPage, {
  metadata as statusMetadata,
} from '../national-show/vendors/payment/status/page';
import { withTicketingTestTitle } from '@/lib/ticketing-test-metadata';

/**
 * Short top-level alias for the vendor stand payment status page. Ozow may cap CancelUrl at 50
 * characters, which no /national-show/... path can fit. Same page and logic; only the URL differs.
 */
export const metadata = withTicketingTestTitle(statusMetadata);

// Route segment config must be declared literally in each page file; it cannot be re-exported.
export const dynamic = 'force-dynamic';

export default VendorStandPaymentStatusPage;
