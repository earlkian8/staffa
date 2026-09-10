import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { setupWizardRoutes } from '../routes';
import type { LeaveTypeBlueprint } from '../types';
import AlreadyConfigured from './already-configured';
import ChoiceCard from './choice-card';
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
 * Step 3 — the kinds of leave the company grants, and the days each carries.
 *
 * The statutory entitlements are pre-ticked at the number the law sets, because
 * a Philippine employer owes them whatever it decides here; the rest are offered
 * unticked. Only the days are editable in the wizard — everything else about a
 * type (its colour, whether it is paid, whether half-days are allowed) is on the
 * Leave Types screen, where there is room to explain what each flag does.
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

    const available = blueprints.filter(
        (blueprint) => !taken.has(blueprint.name.toLowerCase()),
    );

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        codes: available
            .filter((blueprint) => blueprint.recommended)
            .map((blueprint) => blueprint.code),
        days: Object.fromEntries(
            blueprints.map((blueprint) => [
                blueprint.code,
                String(blueprint.default_days),
            ]),
        ) as Record<string, string>,
    });

    const toggle = (code: string, checked: boolean) => {
        clearErrors('codes');

        setData(
            'codes',
            checked
                ? [...data.codes, code]
                : data.codes.filter((value) => value !== code),
        );
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        post(setupWizardRoutes['leave-types'], {
            preserveScroll: true,
            preserveState: true,
            onSuccess: onSaved,
        });
    };

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
                    </div>

                    <ul>
                        {blueprints.map((blueprint) => {
                            const already = taken.has(
                                blueprint.name.toLowerCase(),
                            );
                            const checked = data.codes.includes(blueprint.code);

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
                                        disabled={already}
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
                                            disabled={!checked || already}
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
            </StepBody>

            <StepFooter
                onBack={onBack}
                onSkip={onSkip}
                processing={processing}
                skipping={skipping}
                disabled={data.codes.length === 0}
                note={
                    data.codes.length === 0
                        ? undefined
                        : `Creates ${data.codes.length} leave ${data.codes.length === 1 ? 'type' : 'types'}`
                }
            />
        </form>
    );
}
