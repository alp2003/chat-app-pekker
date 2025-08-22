import { redirect } from 'next/navigation';

// Redirect /chat to main route / since that's where the actual chat lives
export default function ChatPage() {
  redirect('/');
}
