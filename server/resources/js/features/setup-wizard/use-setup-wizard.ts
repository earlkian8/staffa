import { router } from '@inertiajs/react';
import { useCallback, useMemo, useState } from 'react';
import { STEPS } from './constants';
import { setupWizardRoutes } from './routes';
import type { SetupProgress, SetupStep } from './types';

/** What the working pane is showing: the welcome, one step, or the send-off. */
export type WizardView = 'intro' | SetupStep | 'done';

const ORDER: SetupStep[] = STEPS.map((meta) => meta.step);

/**
 * The wizard's navigation and its two whole-wizard actions.
 *
 * Which step is on screen is deliberately client state: a step posts and comes
 * back to the same page (`back()` from the controller), so advancing is the
 * client's decision, taken once the server has confirmed the step. The server
 * still owns what is *recorded* — `progress` is re-read from props after every
 * post, so the ladder and the finish screen can never disagree with the database.
 */
export function useSetupWizard(progress: SetupProgress) {
    const [view, setView] = useState<WizardView>(() => {
        if (progress.completed) {
            return 'done';
        }

        const answered = ORDER.filter(
            (step) => progress.steps[step] !== 'pending',
        ).length;

        // A company that has answered nothing has not started. One that has
        // answered everything but never finished has only the send-off left —
        // which is where finishing happens. Anything in between resumes where it
        // left off rather than at the welcome again.
        if (answered === 0) {
            return 'intro';
        }

        return answered === ORDER.length ? 'done' : progress.resume;
    });

    const [working, setWorking] = useState(false);

    const index = ORDER.indexOf(view as SetupStep);
    const isStep = index !== -1;

    const goNext = useCallback(() => {
        setView((current) => {
            const at = ORDER.indexOf(current as SetupStep);

            if (at === -1) {
                return ORDER[0];
            }

            return at === ORDER.length - 1 ? 'done' : ORDER[at + 1];
        });
    }, []);

    const goBack = useCallback(() => {
        setView((current) => {
            if (current === 'done') {
                return ORDER[ORDER.length - 1];
            }

            const at = ORDER.indexOf(current as SetupStep);

            return at <= 0 ? 'intro' : ORDER[at - 1];
        });
    }, []);

    /** Record a step as passed over, then move on. */
    const skip = useCallback(
        (step: SetupStep) => {
            setWorking(true);

            router.post(
                setupWizardRoutes.skip,
                { step },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => goNext(),
                    onFinish: () => setWorking(false),
                },
            );
        },
        [goNext],
    );

    /** Close setup and go to the dashboard. */
    const finish = useCallback(() => {
        setWorking(true);

        router.post(
            setupWizardRoutes.finish,
            {},
            { onError: () => setWorking(false) },
        );
    }, []);

    const counts = useMemo(() => {
        const answered = ORDER.filter(
            (step) => progress.steps[step] !== 'pending',
        ).length;

        return {
            total: ORDER.length,
            answered,
            done: ORDER.filter((step) => progress.steps[step] === 'done')
                .length,
            skipped: ORDER.filter((step) => progress.steps[step] === 'skipped')
                .length,
            percent: Math.round((answered / ORDER.length) * 100),
        };
    }, [progress.steps]);

    return {
        view,
        setView,
        /** 1-based position of the current step, or 0 outside the ladder. */
        position: isStep ? index + 1 : 0,
        isStep,
        isFirstStep: index === 0,
        working,
        goNext,
        goBack,
        skip,
        finish,
        counts,
    };
}
