import { CircleSlash, Database, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    completion,
    FIELD_STATE_BARS,
    FIELD_STATE_HINTS,
    FIELD_STATE_LABELS,
    FIELD_STATE_ORDER,
    FIELD_STATE_STYLES,
} from '../constants';
import type { FieldCoverage, FieldState } from '../types';

/**
 * Every input a score draws on, with how many employee records actually carry
 * it. The time projections answer *when*; this answers *what*, field by field.
 *
 * Grouping by state rather than by module is the point. A field the system does
 * not record cannot be fixed by data entry, so it belongs nowhere near one that
 * is simply incomplete — and a field that is fully recorded but never fed into
 * the score is neither, and is the most actionable of the three.
 */
export function FieldCoverageTable({ fields }: { fields: FieldCoverage[] }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
                <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    What each score draws on
                </h4>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {fields.length} fields
                </span>
            </div>

            {FIELD_STATE_ORDER.map((state) => {
                const rows = fields.filter((field) => field.state === state);

                if (rows.length === 0) {
                    return null;
                }

                return (
                    <section key={state}>
                        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1">
                            <span
                                className={cn(
                                    'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                    FIELD_STATE_STYLES[state],
                                )}
                            >
                                {FIELD_STATE_LABELS[state]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {FIELD_STATE_HINTS[state]}
                            </span>
                        </header>

                        <ul className="mt-2 overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                            {rows.map((field, index) => (
                                <FieldRow
                                    key={field.key}
                                    field={field}
                                    isFirst={index === 0}
                                />
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}

function FieldRow({
    field,
    isFirst,
}: {
    field: FieldCoverage;
    isFirst: boolean;
}) {
    const percent = completion(field.covered, field.total);
    const unusable = field.state === 'missing';

    return (
        <li
            className={cn(
                'px-3.5 py-3',
                !isFirst &&
                    'border-t border-sidebar-border/70 dark:border-sidebar-border',
            )}
        >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium">
                    {field.label}
                    <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                        {field.source}
                    </span>
                </p>
                <p
                    className={cn(
                        'shrink-0 text-sm font-semibold tabular-nums',
                        unusable && 'text-muted-foreground',
                    )}
                >
                    {field.covered.toLocaleString()}
                    <span className="font-normal text-muted-foreground">
                        {' '}
                        / {field.total.toLocaleString()}
                    </span>
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {percent}%
                    </span>
                </p>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className={cn(
                        'h-full rounded-full',
                        FIELD_STATE_BARS[field.state],
                    )}
                    style={{ width: `${percent}%` }}
                />
            </div>

            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <StateIcon state={field.state} />
                <span>{field.note}</span>
            </p>
        </li>
    );
}

function StateIcon({ state }: { state: FieldState }) {
    const Icon =
        state === 'supplied'
            ? Database
            : state === 'available'
              ? Minus
              : CircleSlash;

    return <Icon className="mt-0.5 size-3 shrink-0" />;
}
