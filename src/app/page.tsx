import { Suspense } from 'react';
import { TodayView } from '@/components/today/TodayView';

export default function TodayPage() {
    return (
        <Suspense>
            <TodayView />
        </Suspense>
    );
}
