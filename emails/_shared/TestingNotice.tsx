import {
  TICKETING_TEST_BANNER_HEADLINE,
  TICKETING_TEST_BANNER_SUBLINE,
  isTicketingTestMode,
} from '@/lib/ticketing-test-mode';

// NOS Design ruling TB4-a: the testing notice as a body row of the ticket and vendor payment
// emails. Table markup, bgcolor plus inline styles, no web fonts and no images, so it survives
// email clients. Renders nothing when payments are live.
export function TestingNotice({ testMode = isTicketingTestMode() }: { testMode?: boolean }) {
  if (!testMode) return null;
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ width: '100%', margin: '0 0 16px' }}
    >
      <tbody>
        <tr>
          <td
            // @ts-expect-error bgcolor is the legacy attribute Outlook honours; absent from React typings
            bgcolor="#F2C230"
            align="center"
            style={{
              backgroundColor: '#F2C230',
              color: '#14110A',
              border: '2px solid #14110A',
              padding: '12px 16px',
              textAlign: 'center',
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
          >
            <div
              style={{
                fontSize: '15px',
                lineHeight: '20px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {TICKETING_TEST_BANNER_HEADLINE}
            </div>
            <div style={{ fontSize: '14px', lineHeight: '20px' }}>
              {TICKETING_TEST_BANNER_SUBLINE}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
