import { Info } from 'lucide-react';

type Props = {
    names: string[];
    noun: string;
    /** Where the same thing is managed properly, once setup is done. */
    where: string;
};

/**
 * Shown when the company already has some of what this step creates — because it
 * came back to the wizard, or configured a module by hand first. The step then
 * says what is there rather than pretending this is day one, and what it adds is
 * only ever on top of it.
 */
export default function AlreadyConfigured({ names, noun, where }: Props) {
    if (names.length === 0) {
        return null;
    }

    const plural = names.length === 1 ? noun : `${noun}s`;

    return (
        <div className="flex items-start gap-2.5 rounded-lg border border-sidebar-border/70 bg-muted/40 px-3.5 py-3 dark:border-sidebar-border">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
                You already have {names.length} {plural} —{' '}
                <span className="text-foreground">{names.join(', ')}</span>.
                Anything you pick here is added alongside them; edit or remove
                them later in {where}.
            </p>
        </div>
    );
}
