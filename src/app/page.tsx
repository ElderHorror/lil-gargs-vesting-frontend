import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to user vesting page s
  redirect('/user/vesting');
}
