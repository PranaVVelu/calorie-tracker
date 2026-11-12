import { redirect } from 'next/navigation';

// Weight tracking now lives on the Progress screen.
export default function WeightRedirect() {
    redirect('/progress');
}
