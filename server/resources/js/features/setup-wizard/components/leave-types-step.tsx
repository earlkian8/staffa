import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { setupWizardRoutes } from '../routes';
import type { LeaveTypeBlueprint, LeaveTypeDraft } from '../types';
import AlreadyConfigured from './already-configured';
import ChoiceCard from './choice-card';
import CustomSection, { CustomRow } from './custom-section';
import LeaveTypeFields from './leave-type-fields';
import StepBody from './step-body';
import StepFooter from './step-footer';

type Props = {
    blueprints: LeaveTypeBlueprint[];
    existing: string[];
    onSaved: () => void;
    onBack: () => void;
    onSkip: () => void;
    skipping: boolean;
};

/**
 * Step 3 — the kinds of leave the company grants, and what each one carries.
 *
 * The statutory entitlements are pre-ticked at the number the law sets, because
 * a Philippine employer owes them whatever it decides here, and a ticked
 * suggestion keeps the policy the blueprint holds — a statutory leave is not
 * something a request body should be able to redefine.
 *
 * Everything else is the company's to write. **Customise** takes a suggestion
 * out of the table and into the company's own list, where its name, code,
 * colour, entitlement and the three policy switches are all editable; so does
 * **Add a leave type**, from nothing. Both create exactly what the Leave Types
 * screen would.
 */
export default function LeaveTypesStep({
    blueprints,
    existing,
    onSaved,
    onBack,
    onSkip,
    skipping,
}: Props) {
    const taken = new Set(existing.map((name) => name.toLowerCase()));

    const { data, setData, post, processing, errors, clearErrors, transform } =
        useForm({
            codes: blueprints
                .filter(
                    (blueprint) =>
                        blueprint.recommended &&
                        !taken.has(blueprint.name.toLowerCase()),
                )
                .map((blueprint) => blueprint.code),
            days: Object.fromEntries(
                blueprints.map((blueprint) => [
                    blueprint.code,
                    String(blueprint.default_days),
                ]),
            ) as Record<string, string>,
            custom: [] as LeaveTypeDraft[],
        });

    // A suggestion the company has taken over is no longer on offer above: it is
    // in the list below, on that company's own terms.
    const customised = new Set(
        data.custom
            .map((row) => row.source)
            .filter((code): code is string => code !== null),
    );

    const toggle = (code: string, checked: boolean) => {
        clearErrors('codes');

        setData(
            'codes',
            checked
                ? [...data.codes, code]
                : data.codes.filter((value) => value !== code),
        );
    };

    const setRow = (index: number, patch: Partial<LeaveTypeDraft>) => {
        setData(
            'custom',
            data.custom.map((row, at) =>
                at === index ? { ...row, ...patch } : row,
            ),
        );
    };

    /** Take a suggestion over, at whatever days are already set against it. */
    const customise = (blueprint: LeaveTypeBlueprint) => {
        clearErrors('codes');

        setData((current) => ({
            ...current,
            codes: current.codes.filter((code) => code !== blueprint.code),
            custom: [
                ...current.custom,
                {
                    name: blueprint.name,
                    code: blueprint.code,
                    description: blueprint.description,
                    color: blueprint.color,
                    default_days:
                        current.days[blueprint.code] ??
                        String(blueprint.default_days),
                    is_paid: blueprint.is_paid,
                    allow_half_day: blueprint.allow_half_day,
                    requires_approval: blueprint.requires_approval,
                    source: blueprint.code,
                },
            ],
        }));
    };

    const total =
        data.codes.length +
        data.custom.filter((row) => row.name.trim() !== '').length;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        transform((payload) => ({
            ...payload,
            // `source` is the wizard's own bookkeeping — which suggestion a row
            // started as — and means nothing to the server.
            custom: payload.custom.map((row) => ({
                name: row.name,
                code: row.code,
                description: row.description,
                color: row.color,
                default_days: row.default_days,
                is_paid: row.is_paid,
                allow_half_day: row.allow_half_day,
                requires_approval: row.requires_approval,
            })),
        }));

        post(setupWizardRoutes['leave-types'], {
            preserveScroll: true,
            preserveState: true,
            onSuccess: onSaved,
        });
    };

    const messages = errors as Record<string, string>;

    const rows = data.custom.map((row, index) => (
        <CustomRow
            // Rows are positional — a leave type has no id until it is saved.
            key={index}
            label={`Leave type ${index + 1}`}
            removeLabel={`Remove ${row.name || `leave type ${index + 1}`}`}
            onRemove={() =>
                setData(
                    'custom',
                    data.custom.filter((_, at) => at !== index),
                )
            }
        >
            <LeaveTypeFields
                index={index}
                row={row}
                errors={messages}
                onChange={(patch) => setRow(index, patch)}
            />
        </CustomRow>
    ));

    return (
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <StepBody>
                <AlreadyConfigured
                    names={existing}
                    noun="leave type"
                    where="Company Setup → Leave Types"
                />

                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <div className="flex items-center gap-3 border-b border-sidebar-border/70 bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase dark:border-sidebar-border">
                        <span className="flex-1">Kind of leave</span>
                        <span className="w-24 text-right">Days a year</span>
                        <span className="w-20" />
                    </div>

                    <ul>
                        {blueprints.map((blueprint) => {
                            const already = taken.has(
                                blueprint.name.toLowerCase(),
                            );
                            const moved = customised.has(blueprint.code);
                            const checked = data.codes.includes(blueprint.code);
                            const closed = already || moved;

                            return (
                                <li
                                    key={blueprint.code}
                                    className="flex items-center gap-3 border-b border-sidebar-border/70 px-4 py-3 transition-colors last:border-b-0 has-[:checked]:bg-[#0ABFBF]/[0.05] dark:border-sidebar-border"
                                >
                                    <ChoiceCard
                                        mode="multiple"
                                        name="leave-types"
                                        value={blueprint.code}
                                        checked={checked}
                                        disabled={closed}
                                        onChange={(next) =>
                                            toggle(blueprint.code, next)
                                        }
                                        bare
                                        className="min-w-0 flex-1"
                                        title={
                                            <span className="flex items-center gap-2">
                                                <span
                                                    aria-hidden
                                                    className="size-2 shrink-0 rounded-full"
                                                    style={{
                                                        background:
                                                            blueprint.color,
                                                    }}
                                                />
                                                {blueprint.name}
                                                {!blueprint.is_paid && (
                                                    <span className="rounded bg-muted px-1.5 py-px text-[10px] font-normal text-muted-foreground">
                                                        unpaid
                                                    </span>
                                                )}
                                                {already && (
                                                    <span className="rounded bg-muted px-1.5 py-px text-[10px] font-normal text-muted-foreground">
                                                        already added
                                                    </span>
                                                )}
                                                {moved && (
                                                    <span className="rounded bg-muted px-1.5 py-px text-[10px] font-normal text-muted-foreground">
                                                        in your list
                                                    </span>
                                                )}
                                            </span>
                                        }
                                        description={blueprint.description}
                                    />

                                    <div className="w-24 shrink-0">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={365}
                                            step="0.5"
                                            inputMode="decimal"
                                            value={data.days[blueprint.code]}
                                            disabled={!checked || closed}
                                            aria-label={`${blueprint.name} days a year`}
                                            onChange={(event) =>
                                                setData('days', {
                                                    ...data.days,
                                                    [blueprint.code]:
                                                        event.target.value,
                                                })
                                            }
                                            className="h-9 text-right tabular-nums"
                                        />
                                    </div>

                                    <div className="w-20 shrink-0 text-right">
                                        {!closed && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    customise(blueprint)
                                                }
                                                className="text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                            >
                                                Customise
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <InputError message={errors.codes} />

                <p className="text-xs leading-relaxed text-muted-foreground">
                    Days a year is the entitlement each employee starts with.
                    Balances are per person and per year, so you can still give
                    someone more or less under Leave → Balances.
                </p>

                <CustomSection
                    title="Leave you define yourself"
                    hint="Anything the list above doesn't cover, and anything you customised — its name, code, entitlement, colour and what an employee is allowed to file against it."
                    addLabel="Add a leave type"
                    empty="Nothing here yet. Add a kind of leave and it works exactly like the ones above — employees file it, approvers see it, balances track it."
                    onAdd={() => {
                        clearErrors('codes');

                        setData('custom', [
                            ...data.custom,
                            {
                                name: '',
                                code: '',
                                description: '',
                                color: '#0ABFBF',
                                default_days: '0',
                                is_paid: true,
                                allow_half_day: true,
                                requires_approval: true,
                                source: null,
                            },
                        ]);
                    }}
                >
                    {rows.length > 0 ? rows : undefined}
                </CustomSection>
            </StepBody>

            <StepFooter
                onBack={onBack}
                onSkip={onSkip}
                processing={processing}
                skipping={skipping}
                disabled={total === 0}
                note={
                    total === 0
                        ? undefined
                        : `Creates ${total} leave ${total === 1 ? 'type' : 'types'}`
                }
            />
        </form>
    );
}
