import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupWizardRoutes } from '../routes';
import type { FrameworkBlueprint } from '../types';
import AlreadyConfigured from './already-configured';
import ChoiceCard from './choice-card';
import StepBody from './step-body';
import StepFooter from './step-footer';

type Props = {
    blueprints: FrameworkBlueprint[];
    existing: string[];
    onSaved: () => void;
    onBack: () => void;
    onSkip: () => void;
    skipping: boolean;
};

/**
 * Step 5 — how the company reviews its people.
 *
 * A framework is a whole apparatus: weighted sections, the criteria inside them,
 * and the instruments those are measured on (ADR 0028). Building one from nothing
 * is the single heaviest thing in Company Setup, so here it is picked — and the
 * card shows the sections and the actual questions, not a count, because that is
 * what the choice is between.
 */
export default function PerformanceStep({
    blueprints,
    existing,
    onSaved,
    onBack,
    onSkip,
    skipping,
}: Props) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        blueprint: blueprints[0]?.key ?? '',
        name: '',
    });

    const chosen = blueprints.find(
        (blueprint) => blueprint.key === data.blueprint,
    );

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        post(setupWizardRoutes.performance, {
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
                    noun="framework"
                    where="Company Setup → Performance Framework"
                />

                <div className="flex flex-col gap-2.5">
                    {blueprints.map((blueprint) => {
                        const selected = data.blueprint === blueprint.key;

                        return (
                            <ChoiceCard
                                key={blueprint.key}
                                mode="single"
                                name="framework"
                                value={blueprint.key}
                                checked={selected}
                                onChange={() => {
                                    clearErrors('blueprint');
                                    setData('blueprint', blueprint.key);
                                }}
                                title={blueprint.name}
                                description={blueprint.description}
                                aside={`${blueprint.items.length} measures`}
                            >
                                <span className="mt-2 flex flex-col gap-2 pl-7">
                                    {blueprint.sections.map((section) => (
                                        <span
                                            key={section.key}
                                            className="block rounded-lg border border-sidebar-border/70 bg-background px-3 py-2 dark:border-sidebar-border"
                                        >
                                            <span className="flex items-baseline justify-between gap-3">
                                                <span className="text-xs font-semibold text-foreground">
                                                    {section.name}
                                                </span>
                                                <span className="shrink-0 text-[11px] text-[#0a8b91] tabular-nums dark:text-[#0ABFBF]">
                                                    {section.weight}% of the
                                                    result
                                                </span>
                                            </span>

                                            {selected && (
                                                <span className="mt-1.5 flex flex-col gap-1">
                                                    {blueprint.items
                                                        .filter(
                                                            (item) =>
                                                                item.section ===
                                                                section.key,
                                                        )
                                                        .map((item) => (
                                                            <span
                                                                key={item.name}
                                                                className="flex items-baseline justify-between gap-3 text-[11px]"
                                                            >
                                                                <span className="text-muted-foreground">
                                                                    {item.name}
                                                                    <span className="px-1.5 text-muted-foreground/40">
                                                                        ·
                                                                    </span>
                                                                    <span className="text-muted-foreground/70">
                                                                        {
                                                                            item.scale
                                                                        }
                                                                    </span>
                                                                </span>
                                                                <span className="shrink-0 text-muted-foreground/70 tabular-nums">
                                                                    {
                                                                        item.weight
                                                                    }
                                                                    % of section
                                                                </span>
                                                            </span>
                                                        ))}
                                                </span>
                                            )}
                                        </span>
                                    ))}
                                </span>
                            </ChoiceCard>
                        );
                    })}
                </div>

                <InputError message={errors.blueprint} />

                <div className="max-w-sm">
                    <Label htmlFor="framework-name" className="mb-1.5 block">
                        Call it something else{' '}
                        <span className="text-muted-foreground">
                            (optional)
                        </span>
                    </Label>
                    <Input
                        id="framework-name"
                        value={data.name}
                        onChange={(event) =>
                            setData('name', event.target.value)
                        }
                        placeholder={chosen?.name ?? 'Balanced Appraisal'}
                    />
                    <InputError message={errors.name} className="mt-1.5" />
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                    This also fills your criteria catalogue and the rating
                    scales behind it, so the framework is editable the moment it
                    exists — reweight a section, swap a criterion, or write a
                    new one from Company Setup → Performance Framework.
                </p>
            </StepBody>

            <StepFooter
                onBack={onBack}
                onSkip={onSkip}
                processing={processing}
                skipping={skipping}
                disabled={data.blueprint === ''}
                note={
                    chosen
                        ? `Creates "${data.name.trim() || chosen.name}"`
                        : undefined
                }
            />
        </form>
    );
}
