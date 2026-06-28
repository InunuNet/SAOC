import { redirect } from 'next/navigation';

export { metadata } from '../page';

export default function UpcomingShowPage() {
  redirect('/national-show');
}
