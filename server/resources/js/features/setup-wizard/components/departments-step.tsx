import { useForm } from '@inertiajs/react';
import { Plus, X } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setupWizardRoutes } from '../routes';
import type { DepartmentBlueprint } from '../types';
import AlreadyConfigured from './already-configured';
import ChoiceCard from './choice-card';
import StepBody from './step-body';
import StepFooter from './step-footer';

type CustomRow = { name: string; code: string };

type Props = {
    blueprints: DepartmentBlueprint[];
    existing: string[];
    onSaved: () => void;
    onBack: () => void;
    onSkip: () => void;
    skipping: boolean;
};

/**
 * Step 2 — the org structure. Tick the functions the company has, and add the
 * ones only it has.
 *
 * Nothing is pre-ticked: a department list is the one thing on this screen that
 * really is different at every company, and a pre-filled one would be adopted
 * unread. Suggestions are sent as codes and resolved server-side, so the wording
 * of a suggested department is not the client's to decide.
 */
export default function DepartmentsStep({
    blueprints,
    existing,
    onSaved,
    onBack,
    onSkip,
    skipping,
}: Props) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        codes: [] as string[],
        custom: [] as CustomRow[],
    });

    const taken = new Set(existing.map((name) => name.toLowerCase()));

    const toggle = (code: string, checked: boolean) => {
        clearErrors('codes');

        setData(
            'codes',
            checked
                ? [...data.codes, code]
                : data.codes.filter((value) => value !== code),
        );
    };

    const setRow = (index: number, patch: Partial<CustomRow>) => {
        setData(
            'custom',
            data.custom.map((row, at) =>
                at === index ? { ...row, ...patch } : row,
            ),
        );
    };

    const total =
        data.codes.length +
        data.custom.filter((r) => r.name.trim() !== '').length;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        post(setupWizardRoutes.departments, {
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
                    noun="department"
                    where="Company Setup → Departments"
                />

                <div>
                    <h2 className="text-sm font-semibold">
                        Common departments
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Pick the ones your company has. You can rename them,
                        nest them and add positions later.
                    </p>

                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        {blueprints.map((blueprint) => {
                            const already = taken.has(
                                blueprint.name.toLowerCase(),
                            );

                            return (
                                <ChoiceCard
                                    key={blueprint.code}
                                    mode="multiple"
                                    name="departments"
                                    value={blueprint.code}
                                    checked={data.codes.includes(
                                        blueprint.code,
                                    )}
                                    onChange={(checked) =>
                                        toggle(blueprint.code, checked)
                                    }
                                    disabled={already}
                                    title={blueprint.name}
                                    description={blueprint.description}
                                    aside={
                                        already ? (
                                            'Already added'
                                        ) : (
                                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wide">
                                                {blueprint.code}
                                            </code>
                                        )
                                    }
                                />
                            );
                        })}
                    </div>

                    <InputError message={errors.codes} className="mt-2" />
                </div>

                <div>
                    <h2 className="text-sm font-semibold">
                        Anything else you have
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        A short code goes on reports and exports. Leave it blank
                        and we'll make one from the name.
                    </p>

                    <div className="mt-3 flex flex-col gap-2">
                        {data.custom.map((row, index) => (
                            <div
                                // Rows are positional — a typed department has
                                // no id until it is saved.
                                key={index}
                                className="flex items-start gap-2"
                            >
                                <div className="flex-1">
                                    <Input
                                        value={row.name}
                                        onChange={(event) =>
                                            setRow(index, {
                                                name: event.target.value,
                                            })
                                        }
                                        placeholder="Department name"
                                        aria-label={`Department ${index + 1} name`}
                                    />
                                    <InputError
                                        message={
                                            errors[
                                                `custom.${index}.name` as keyof typeof errors
                                            ]
                                        }
                                        className="mt-1"
                                    />
                                </div>
                                <div className="w-28">
                                    <Input
                                        value={row.code}
                                        onChange={(event) =>
                                            setRow(index, {
                                                code: event.target.value.toUpperCase(),
                                            })
                                        }
                                        placeholder="Code"
                                        aria-label={`Department ${index + 1} code`}
                                        className="font-mono text-xs uppercase"
                                    />
                                    <InputError
                                        message={
                                            errors[
                                                `custom.${index}.code` as keyof typeof errors
                                            ]
                                        }
                                        className="mt-1"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="mt-0.5 size-9 shrink-0 text-muted-foreground"
                                    onClick={() =>
                                        setData(
                                            'custom',
                                            data.custom.filter(
                                                (_, at) => at !== index,
                                            ),
                                        )
                                    }
                                    aria-label={`Remove department ${index + 1}`}
                                >
                                    <X className="size-4" />
                                </Button>
                            </div>
                        ))}

                        <Button
                            type="button"
                            variant="outline"
                            className="w-fit"
                            onClick={() =>
                                setData('custom', [
                                    ...data.custom,
                                    { name: '', code: '' },
                                ])
                            }
                        >
                            <Plus className="size-4" />
                            Add a department
                        </Button>
                    </div>
                </div>
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
                        : `Creates ${total} ${total === 1 ? 'department' : 'departments'}`
                }
            />
        </form>
    );
}
