<?php

namespace App\Support\Setup;

use App\Models\Department;
use App\Models\KpiCriterion;
use App\Models\LeaveType;
use App\Models\RatingScale;
use App\Models\RecruitmentPipeline;
use App\Models\ReviewTemplate;
use App\Support\Performance\RatingModel;
use Illuminate\Support\Facades\DB;

/**
 * Writes a chosen {@see SetupBlueprints} entry into the current tenant.
 *
 * Every method here is idempotent against what the company already has: a code
 * or a name that exists is left alone rather than duplicated, so re-running a
 * wizard step (a double submit, a second owner walking it) cannot produce two
 * "Vacation Leave"s. That also means a company that half-configured a module by
 * hand can still adopt a blueprint for the rest of it.
 *
 * The tenant is whatever `BelongsToOrganization` stamps, so callers bind it the
 * usual way and never pass an organisation in.
 */
class BlueprintInstaller
{
    /**
     * Create the named departments (by blueprint `code`). Returns how many were
     * new — the count the wizard reports back.
     *
     * @param  list<string>  $codes
     */
    public static function departments(array $codes): int
    {
        $created = 0;

        foreach (SetupBlueprints::departments() as $blueprint) {
            if (! in_array($blueprint['code'], $codes, true)) {
                continue;
            }

            // The per-tenant unique index on `code` ignores archived rows, so ask
            // the same question it does rather than `firstOrCreate` on a value a
            // trashed department may still hold.
            if (Department::where('code', $blueprint['code'])->exists()) {
                continue;
            }

            Department::create([
                'name' => $blueprint['name'],
                'code' => $blueprint['code'],
                'description' => $blueprint['description'],
            ]);

            $created++;
        }

        return $created;
    }

    /**
     * Create the named leave types (by blueprint `code`), each with the days the
     * owner settled on in the wizard.
     *
     * @param  array<string, float>  $days  blueprint code => annual entitlement
     * @param  list<string>  $codes
     */
    public static function leaveTypes(array $codes, array $days = []): int
    {
        $created = 0;

        foreach (SetupBlueprints::leaveTypes() as $blueprint) {
            if (! in_array($blueprint['code'], $codes, true)) {
                continue;
            }

            if (LeaveType::where('code', $blueprint['code'])->exists()) {
                continue;
            }

            LeaveType::create([
                'name' => $blueprint['name'],
                'code' => $blueprint['code'],
                'description' => $blueprint['description'],
                'color' => $blueprint['color'],
                'default_days' => $days[$blueprint['code']] ?? $blueprint['default_days'],
                'is_paid' => $blueprint['is_paid'],
                'allow_half_day' => $blueprint['allow_half_day'],
                'requires_approval' => $blueprint['requires_approval'],
                'is_active' => true,
            ]);

            $created++;
        }

        return $created;
    }

    /**
     * Create a hiring process from a blueprint, named by the owner. The first
     * pipeline a company has is always its default — nothing else could resolve a
     * posting's pipeline (see {@see RecruitmentPipeline}).
     *
     * @param  array{name: string, stages: list<array{name: string, kind: string}>}  $blueprint
     */
    public static function pipeline(array $blueprint, ?string $name = null): RecruitmentPipeline
    {
        return DB::transaction(function () use ($blueprint, $name): RecruitmentPipeline {
            $pipeline = RecruitmentPipeline::create([
                'name' => $name ?: $blueprint['name'],
                'is_default' => ! RecruitmentPipeline::query()->exists(),
            ]);

            $pipeline->enforceSingleDefault();
            $pipeline->syncStages($blueprint['stages']);

            return $pipeline;
        });
    }

    /**
     * Create an appraisal framework from a blueprint: the instruments it measures
     * on, the catalogue criteria it draws from, and the framework itself with its
     * sections, items and rating model.
     *
     * Scales and criteria are resolved by name, so adopting a second blueprint
     * that shares "Communication" reuses the catalogue entry rather than
     * splitting the company's vocabulary in two.
     *
     * @param  array<string, mixed>  $blueprint
     */
    public static function framework(array $blueprint, ?string $name = null): ReviewTemplate
    {
        return DB::transaction(function () use ($blueprint, $name): ReviewTemplate {
            $catalogue = SetupBlueprints::criteria();

            // 1. The instruments — only the ones this framework actually measures on.
            $needed = [$blueprint['scale']];

            foreach ($blueprint['items'] as $item) {
                $needed[] = $catalogue[$item['criterion']]['scale'];
            }

            $scales = [];

            foreach (array_unique($needed) as $scaleName) {
                $scales[$scaleName] = self::scale($scaleName, isDefault: $scaleName === $blueprint['scale']);
            }

            // 2. The criteria catalogue entries the framework draws from.
            $criteria = [];
            $order = KpiCriterion::max('sort_order') ?? 0;

            foreach ($blueprint['items'] as $item) {
                $key = $item['criterion'];

                if (isset($criteria[$key])) {
                    continue;
                }

                $definition = $catalogue[$key];

                $criteria[$key] = KpiCriterion::firstOrCreate(
                    ['name' => $definition['name']],
                    [
                        'description' => $definition['description'],
                        'weight' => $definition['weight'],
                        'rating_scale_id' => $scales[$definition['scale']]->id,
                        'is_active' => true,
                        'sort_order' => ++$order,
                    ],
                );
            }

            // 3. The framework. A company's first framework is its default, so an
            //    appraisal opened before anything else is configured resolves one.
            $template = ReviewTemplate::create([
                'name' => $name ?: $blueprint['name'],
                'description' => $blueprint['description'],
                'rating_scale_id' => $scales[$blueprint['scale']]->id,
                'sections' => $blueprint['sections'],
                'bands' => RatingModel::defaultBands(),
                'result_display' => $blueprint['result_display'],
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
                    'kpi_criterion_id' => $criteria[$item['criterion']]->id,
                    'rating_scale_id' => null,
                    'section_key' => $item['section'],
                    'name' => $catalogue[$item['criterion']]['name'],
                    'description' => $catalogue[$item['criterion']]['description'],
                    'weight' => $item['weight'],
                    'sort_order' => $index,
                ], $blueprint['items'], array_keys($blueprint['items']))
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
