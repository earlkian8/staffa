import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type Props = {
    onBack: () => void;
    onSkip: () => void;
    /** Disabled while the step's own save is in flight, and vice versa. */
    processing: boolean;
    skipping: boolean;
    /** The step has nothing valid to save yet. */
    disabled?: boolean;
    submitLabel?: string;
    /**
     * There is nothing to save on this step — the person may not configure the
     * module behind it. Skipping becomes the forward action rather than sitting
     * next to a button that can never be pressed.
     */
    skipOnly?: boolean;
    /** A short line above the buttons — what this step will actually create. */
    note?: string;
};

/**
 * The action row every step ends on. Each step renders its own, so the button
 * always submits the form it belongs to and every step owns its own in-flight
 * state — but they are laid out once, here, so the wizard's floor never moves.
 *
 * Skipping sits next to saving rather than hidden in the corner: passing over a
 * step is a legitimate answer, and a company with nothing to say about hiring
 * yet should not have to hunt for the way past it.
 */
export default function StepFooter({
    onBack,
    onSkip,
    processing,
    skipping,
    disabled = false,
    submitLabel = 'Save and continue',
    skipOnly = false,
    note,
}: Props) {
    const busy = processing || skipping;

    return (
        <div className="shrink-0 border-t border-sidebar-border/70 bg-background/85 px-5 py-3.5 backdrop-blur md:px-8 dark:border-sidebar-border">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5 sm:flex-row sm:items-center">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onBack}
                    disabled={busy}
                    className="hidden text-muted-foreground sm:inline-flex"
                >
                    <ArrowLeft className="size-4" />
                    Back
                </Button>

                {note && (
                    <p className="order-last text-xs text-muted-foreground sm:order-none sm:ml-auto sm:text-right">
                        {note}
                    </p>
                )}

                <div
                    className={`flex items-center gap-2 ${note ? '' : 'sm:ml-auto'}`}
                >
                    <Button
                        type="button"
                        variant={skipOnly ? 'default' : 'ghost'}
                        onClick={onSkip}
                        disabled={busy}
                        className={
                            skipOnly
                                ? 'flex-1 sm:flex-none'
                                : 'flex-1 text-muted-foreground sm:flex-none'
                        }
                    >
                        {skipping && <Spinner />}
                        Skip this step
                        {skipOnly && !skipping && (
                            <ArrowRight className="size-4" />
                        )}
                    </Button>
                    {!skipOnly && (
                        <Button
                            type="submit"
                            disabled={busy || disabled}
                            className="flex-1 sm:flex-none"
                        >
                            {processing && <Spinner />}
                            {submitLabel}
                            {!processing && <ArrowRight className="size-4" />}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
