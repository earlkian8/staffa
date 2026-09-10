<?php

namespace App\Support\Setup;

use App\Models\Department;
use App\Models\KpiCriterion;
use App\Models\LeaveType;
use App\Models\RatingScale;
use App\Models\RecruitmentPipeline;
use App\Models\ReviewTemplate;
use Illuminate\Support\Facades\DB;

/**
 * Writes what a company settled on in the setup wizard into its tenant.
 *
 * Everything here takes a definition from {@see SetupDefinition} rather than a
 * blueprint key or a request body, so adopting one of the offers and designing
 * something from nothing land through exactly the same code — which is what
 * makes a bespoke pipeline a first-class pipeline rather than a lesser one.
 *
 * Every method is idempotent against what the company already has: a code or a
 * name that exists is left alone rather than duplicated, so re-running a wizard
 * step (a double submit, a second owner walking it) cannot produce two
 * "Vacation Leave"s. That also means a company that half-configured a module by
 * hand can still finish the rest here.
 *
 * The tenant is whatever `BelongsToOrganization` stamps, so callers bind it the
 * usual way and never pass an organisation in.
 */
class SetupInstaller
{
    /**
     * Create the given departments. Returns how many were new — the count the
     * wizard reports back.
     *
     * @param  list<array{name: string, code: string, description: string|null}>  $definitions
     */
    public static function departments(array $definitions): int
    {
        $created = 0;

        foreach ($definitions as $definition) {
            // The per-tenant unique index on `code` ignores archived rows, so ask
            // the same question it does rather than `firstOrCreate` on a value a
            // trashed department may still hold.
            if (Department::where('code', $definition['code'])->exists()) {
                continue;
            }

            Department::create([
                'name' => $definition['name'],
                'code' => $definition['code'],
                'description' => $definition['description'],
            ]);

            $created++;
        }

        return $created;
    }

    /**
     * Create the given kinds of leave, each with the entitlement and policy it
     * was defined with.
     *
     * @param  list<array<string, mixed>>  $definitions
     */
    public static function leaveTypes(array $definitions): int
    {
        $created = 0;

        foreach ($definitions as $definition) {
            if (LeaveType::where('code', $definition['code'])->exists()) {
                continue;
            }

            LeaveType::create([
                'name' => $definition['name'],
                'code' => $definition['code'],
                'description' => $definition['description'],
                'color' => $definition['color'],
                'default_days' => $definition['default_days'],
                'is_paid' => $definition['is_paid'],
                'allow_half_day' => $definition['allow_half_day'],
                'requires_approval' => $definition['requires_approval'],
                'is_active' => true,
            ]);

            $created++;
        }

        return $created;
    }

    /**
     * Create a hiring process. The first pipeline a company has is always its
     * default — nothing else could resolve a posting's pipeline (see
     * {@see RecruitmentPipeline}).
     *
     * @param  array{name: string, stages: list<array{name: string, kind: string}>}  $definition
     */
    public static function pipeline(array $definition): RecruitmentPipeline
    {
        return DB::transaction(function () use ($definition): RecruitmentPipeline {
            $pipeline = RecruitmentPipeline::create([
                'name' => $definition['name'],
                'is_default' => ! RecruitmentPipeline::query()->exists(),
            ]);

            $pipeline->enforceSingleDefault();
            $pipeline->syncStages($definition['stages']);

            return $pipeline;
        });
    }

    /**
     * Create an appraisal framework: the instruments it measures on, the
     * criteria catalogue it draws from, and the framework itself with its
     * sections, items and rating model.
     *
     * Scales and criteria are resolved by name, so a second framework that also
     * measures "Communication" reuses the catalogue entry rather than splitting
     * the company's vocabulary in two. A criterion the company wrote for itself
     * joins that catalogue on the same terms as one it adopted — in the wizard,
     * writing a criterion *is* how the catalogue gets built.
     *
     * @param  array<string, mixed>  $definition
     */
    public static function framework(array $definition): ReviewTemplate
    {
        return DB::transaction(function () use ($definition): ReviewTemplate {
            // 1. The instruments — only the ones this framework actually measures on.
            $needed = [$definition['scale']];

            foreach ($definition['items'] as $item) {
                $needed[] = $item['scale'];
            }

            $scales = [];

            foreach (array_unique($needed) as $scaleName) {
                $scales[$scaleName] = self::scale($scaleName, isDefault: $scaleName === $definition['scale']);
            }

            // 2. The criteria catalogue entries the framework draws from.
            $criteria = [];
            $order = KpiCriterion::max('sort_order') ?? 0;

            foreach ($definition['items'] as $item) {
                if (isset($criteria[$item['name']])) {
                    continue;
                }

                $criteria[$item['name']] = KpiCriterion::firstOrCreate(
                    ['name' => $item['name']],
                    [
                        'description' => $item['description'],
                        'weight' => $item['weight'],
                        'rating_scale_id' => $scales[$item['scale']]->id,
                        'is_active' => true,
                        'sort_order' => ++$order,
                    ],
                );
            }

            // 3. The framework. A company's first framework is its default, so an
            //    appraisal opened before anything else is configured resolves one.
            $template = ReviewTemplate::create([
                'name' => $definition['name'],
                'description' => $definition['description'],
                'rating_scale_id' => $scales[$definition['scale']]->id,
                'sections' => $definition['sections'],
                'bands' => $definition['bands'],
                'result_display' => $definition['result_display'],
                'applies_to' => 'all',
                'applies_to_values' => null,
                'is_default' => ! ReviewTemplate::query()->exists(),
                'is_active' => true,
            ]);

            if ($template->is_default) {
                ReviewTemplate::query()->whereKeyNot($template->id)->update(['is_default' => false]);
            }

            // 4. Its lines. `rating_scale_id` is left null so each line follows the
            //    criterion's own scale rather than pinning a copy of it — the same
            //    thing the framework editor does when a line comes from the catalogue.
            $template->items()->createMany(
                array_map(fn (array $item, int $index): array => [
                    'kpi_criterion_id' => $criteria[$item['name']]->id,
                    'rating_scale_id' => null,
                    'section_key' => $item['section'],
                    'name' => $item['name'],
                    'description' => $item['description'],
                    'weight' => $item['weight'],
                    'sort_order' => $index,
                ], $definition['items'], array_keys($definition['items']))
            );

            return $template;
        });
    }

    /**
     * A rating scale from the shared library, created only if the company has not
     * already defined one under that name.
     */
    private static function scale(string $name, bool $isDefault): RatingScale
    {
        $existing = RatingScale::where('name', $name)->first();

        if ($existing !== null) {
            return $existing;
        }

        $definition = SetupBlueprints::scale($name);

        return RatingScale::create([
            'name' => $definition['name'],
            'description' => $definition['description'],
            'type' => $definition['type'],
            'min' => $definition['min'],
            'max' => $definition['max'],
            'step' => $definition['step'],
            'levels' => $definition['levels'],
            // The library's own `is_default` describes the library, not this
            // company — the scale the chosen framework measures on is the one
            // that should be pre-selected here.
            'is_default' => $isDefault && ! RatingScale::where('is_default', true)->exists(),
        ]);
    }
}
