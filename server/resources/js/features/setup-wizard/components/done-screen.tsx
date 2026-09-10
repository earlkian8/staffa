import { Link } from '@inertiajs/react';
import { ArrowRight, Check, ExternalLink, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { REMAINING_SETUP, STEPS } from '../constants';
import type { SetupStep, StepStatus } from '../types';

type Props = {
    companyName: string;
    statuses: Record<SetupStep, StepStatus>;
    onRevisit: (step: SetupStep) => void;
    onBack: () => void;
    onFinish: () => void;
    finishing: boolean;
    /** Already closed once — the wizard was reopened from Company Setup. */
    alreadyCompleted: boolean;
};

/**
 * The send-off. It states what was actually configured and what was passed over,
 * with a way back into each — a skipped step is unfinished business, not a
 * failure, and the screen should not pretend it did not happen.
 */
export default function DoneScreen({
    companyName,
    statuses,
    onRevisit,
    onBack,
    onFinish,
    finishing,
    alreadyCompleted,
}: Props) {
    const outstanding = STEPS.filter(
        (meta) => statuses[meta.step] !== 'done',
    ).length;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-10 md:px-8 md:py-12">
                <div className="mx-auto flex w-full max-w-2xl flex-col">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-[#0ABFBF]/10 text-[#0ABFBF]">
                        <Check className="size-5" strokeWidth={2.5} />
                    </span>

                    <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                        {outstanding === 0
                            ? `${companyName} is fully set up.`
                            : `${companyName} is ready to use.`}
                    </h1>
                    <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                        {outstanding === 0
                            ? 'Everything the modules read from is in place. Add your people next — the rest of the system fills itself in from there.'
                            : `Here's where each step landed. ${outstanding === 1 ? 'One is' : `${outstanding} are`} still open, and you can pick ${outstanding === 1 ? 'it' : 'them'} up any time.`}
                    </p>

                    <ul className="mt-7 flex flex-col">
                        {STEPS.map((meta) => {
                            const status = statuses[meta.step];

                            return (
                                <li
                                    key={meta.step}
                                    className="flex items-center gap-3.5 border-b border-sidebar-border/70 py-3 last:border-b-0 dark:border-sidebar-border"
                                >
                                    <span
                                        className={
                                            status === 'done'
                                                ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0ABFBF] text-white'
                                                : 'flex size-6 shrink-0 items-center justify-center rounded-full border border-input text-muted-foreground'
                                        }
                                    >
                                        {status === 'done' ? (
                                            <Check
                                                className="size-3.5"
                                                strokeWidth={3}
                                            />
                                        ) : (
                                            <Minus
                                                className="size-3.5"
                                                strokeWidth={3}
                                            />
                                        )}
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium text-foreground">
                                            {meta.label}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {status === 'done'
                                                ? 'Configured'
                                                : status === 'skipped'
                                                  ? 'Skipped for now'
                                                  : 'Not started'}
                                        </span>
                                    </span>

                                    {status === 'done' ? (
                                        <Link
                                            href={meta.href}
                                            className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                        >
                                            Open
                                        </Link>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onRevisit(meta.step)}
                                            className="shrink-0 text-xs font-medium text-[#0a8b91] underline-offset-4 hover:underline dark:text-[#0ABFBF]"
                                        >
                                            Do it now
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    <div className="mt-9">
                        <h2 className="text-sm font-semibold text-foreground">
                            Also worth a look
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Not needed to start, but each one makes a module do
                            more.
                        </p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {REMAINING_SETUP.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="group rounded-xl border border-sidebar-border/70 bg-card p-3.5 transition-colors hover:border-[#0ABFBF]/50 dark:border-sidebar-border"
                                >
                                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                        {item.title}
                                        <ExternalLink className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                    </span>
                                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                        {item.note}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="shrink-0 border-t border-sidebar-border/70 bg-background/85 px-5 py-3.5 backdrop-blur md:px-8 dark:border-sidebar-border">
                <div className="mx-auto flex w-full max-w-2xl items-center">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onBack}
                        disabled={finishing}
                        className="text-muted-foreground"
                    >
                        Back
                    </Button>
                    <Button
                        type="button"
                        onClick={onFinish}
                        disabled={finishing}
                        className="ml-auto"
                    >
                        {finishing && <Spinner />}
                        {alreadyCompleted
                            ? 'Back to dashboard'
                            : 'Finish and go to dashboard'}
                        {!finishing && <ArrowRight className="size-4" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
