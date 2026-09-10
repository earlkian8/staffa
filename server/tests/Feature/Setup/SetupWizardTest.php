<?php

use App\Models\Department;
use App\Models\KpiCriterion;
use App\Models\LeaveType;
use App\Models\Organization;
use App\Models\RatingScale;
use App\Models\RecruitmentPipeline;
use App\Models\ReviewTemplate;
use App\Models\User;
use App\Support\OrganizationProvisioner;
use App\Support\Setup\CompanySetup;
use App\Support\Setup\SetupBlueprints;
use App\Support\Tenancy;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Guided company setup: the wizard a brand-new tenant is taken through before its
 * dashboard, and the redirect that takes it there.
 */

/** Put the acting tenant back where registration leaves it: empty and unset-up. */
function unfinishedTenant(): Organization
{
    $organization = testOrganization();
    $organization->forceFill(['setup_completed_at' => null, 'setup_steps' => null])->save();

    return $organization;
}

// ── The redirect ─────────────────────────────────────────────────────────────

test('registration leaves the new company owing its setup', function () {
    $this->post(route('register.store'), [
        'organization_name' => 'Brand New Co',
        'first_name' => 'Owner',
        'last_name' => 'Person',
        'email' => 'owner@brandnew.test',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertSessionHasNoErrors();

    $organization = Organization::where('name', 'Brand New Co')->firstOrFail();

    expect($organization->setup_completed_at)->toBeNull()
        ->and($organization->hasFinishedSetup())->toBeFalse();
});

test('an owner whose company has never been set up lands on the wizard', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->get(route('dashboard'))->assertRedirect(route('setup.wizard.show'));
    $this->get(route('employees.index'))->assertRedirect(route('setup.wizard.show'));
});

test('a company that has finished setup is left alone', function () {
    actingAsSuperAdmin();

    // The factory stands for a company already in use.
    expect(testOrganization()->hasFinishedSetup())->toBeTrue();

    $this->get(route('dashboard'))->assertOk();
});

test('somebody who cannot configure the company is never trapped in the wizard', function () {
    actingAsUserWith(['employees.view']);
    unfinishedTenant();

    $this->get(route('employees.index'))->assertOk();
});

test('the wizard itself, the way out, and account settings stay reachable', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->get(route('setup.wizard.show'))->assertOk();
    $this->get(route('profile.edit'))->assertOk();
    $this->get(route('appearance.edit'))->assertOk();
    $this->post(route('logout'))->assertRedirect();
});

test('an outstanding setup does not interrupt anything but a page view', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    // A JSON endpoint answers rather than being bounced into an HTML redirect.
    $this->getJson(route('assistant.conversations.index'))->assertOk();

    // Neither does a mutation — RequireCompanySetup only ever acts on GET/HEAD.
    $this->post(route('setup.leave-types.store'), [
        'name' => 'Study Leave', 'code' => 'STL', 'color' => '#0ABFBF', 'default_days' => 5,
    ])->assertSessionHasNoErrors();
});

// ── The page ─────────────────────────────────────────────────────────────────

test('the wizard renders with its blueprints, progress and permissions', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->get(route('setup.wizard.show'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('setup/wizard')
            ->has('company')
            ->has('blueprints.departments', count(SetupBlueprints::departments()))
            ->has('blueprints.leaveTypes', count(SetupBlueprints::leaveTypes()))
            ->has('blueprints.pipelines', count(SetupBlueprints::pipelines()))
            ->has('blueprints.frameworks', count(SetupBlueprints::frameworks()))
            ->where('progress.resume', CompanySetup::COMPANY)
            ->where('progress.completed', false)
            ->where('progress.steps.company', CompanySetup::PENDING)
            ->where('can.company', true)
            ->has('existing.departments'));
});

test('a framework blueprint arrives with its criteria resolved, not just counted', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->get(route('setup.wizard.show'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('blueprints.frameworks.0.items.0.name', 'Goal attainment')
            ->where('blueprints.frameworks.0.items.0.scale', 'Goal attainment (%)')
            ->etc());
});

test('the wizard is closed to a user who cannot manage the company profile', function () {
    actingAsUserWith(['setup.company.view']);

    $this->get(route('setup.wizard.show'))->assertForbidden();
});

// ── Step 1: company profile ──────────────────────────────────────────────────

test('the company step saves the profile and records the step', function () {
    actingAsSuperAdmin();
    $organization = unfinishedTenant();

    $this->post(route('setup.wizard.company'), [
        'name' => 'Acme Manufacturing',
        'legal_name' => 'Acme Manufacturing Corporation',
        'email' => 'hr@acme.test',
        'tin' => '123-456-789-000',
    ])->assertSessionHasNoErrors();

    $organization->refresh();

    expect($organization->name)->toBe('Acme Manufacturing')
        ->and($organization->legal_name)->toBe('Acme Manufacturing Corporation')
        ->and(CompanySetup::statuses($organization)['company'])->toBe(CompanySetup::DONE)
        // Saving a step is not finishing setup.
        ->and($organization->hasFinishedSetup())->toBeFalse();
});

// ── Step 2: departments ──────────────────────────────────────────────────────

test('the departments step creates the picked suggestions and the typed ones', function () {
    actingAsSuperAdmin();
    $organization = unfinishedTenant();

    $this->post(route('setup.wizard.departments'), [
        'codes' => ['HR', 'FIN'],
        'custom' => [['name' => 'Quality Assurance', 'code' => 'qa']],
    ])->assertSessionHasNoErrors();

    expect(Department::pluck('code')->sort()->values()->all())->toBe(['FIN', 'HR', 'QA'])
        ->and(Department::where('code', 'HR')->value('name'))->toBe('Human Resources')
        ->and(CompanySetup::statuses($organization->refresh())['departments'])->toBe(CompanySetup::DONE);
});

test('a typed department with no code gets one from its name', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->post(route('setup.wizard.departments'), [
        'codes' => [],
        'custom' => [['name' => 'Research', 'code' => '']],
    ])->assertSessionHasNoErrors();

    expect(Department::where('name', 'Research')->value('code'))->toBe('RESEARCH');
});

test('the departments step refuses a step that would create nothing', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->post(route('setup.wizard.departments'), ['codes' => [], 'custom' => []])
        ->assertSessionHasErrors('codes');

    expect(Department::count())->toBe(0);
});

test('the departments step refuses a code the company already has, and one repeated in the list', function () {
    actingAsSuperAdmin();
    unfinishedTenant();
    Department::create(['name' => 'People Ops', 'code' => 'HR']);

    $this->post(route('setup.wizard.departments'), [
        'codes' => [],
        'custom' => [['name' => 'Human Resources', 'code' => 'HR']],
    ])->assertSessionHasErrors('custom.0.code');

    $this->post(route('setup.wizard.departments'), [
        'codes' => ['FIN'],
        'custom' => [['name' => 'Finance Team', 'code' => 'FIN']],
    ])->assertSessionHasErrors('custom.0.code');
});

test('a suggested department the company already has is passed over rather than duplicated', function () {
    actingAsSuperAdmin();
    unfinishedTenant();
    Department::create(['name' => 'Human Resources', 'code' => 'HR']);

    $this->post(route('setup.wizard.departments'), ['codes' => ['HR', 'FIN'], 'custom' => []])
        ->assertSessionHasNoErrors();

    expect(Department::where('code', 'HR')->count())->toBe(1)
        ->and(Department::count())->toBe(2);
});

// ── Step 3: leave types ──────────────────────────────────────────────────────

test('the leave step creates the ticked types at the days given', function () {
    actingAsSuperAdmin();
    $organization = unfinishedTenant();

    $this->post(route('setup.wizard.leave-types'), [
        'codes' => ['VL', 'SL'],
        'days' => ['VL' => 20, 'SL' => 15, 'ML' => 105],
    ])->assertSessionHasNoErrors();

    expect(LeaveType::pluck('code')->sort()->values()->all())->toBe(['SL', 'VL'])
        ->and((float) LeaveType::where('code', 'VL')->value('default_days'))->toBe(20.0)
        ->and(LeaveType::where('code', 'VL')->value('is_paid'))->toBeTrue()
        ->and(CompanySetup::statuses($organization->refresh())['leave-types'])->toBe(CompanySetup::DONE);
});

test('a ticked type with no days falls back to what the blueprint carries', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->post(route('setup.wizard.leave-types'), ['codes' => ['ML'], 'days' => []])
        ->assertSessionHasNoErrors();

    expect((float) LeaveType::where('code', 'ML')->value('default_days'))->toBe(105.0);
});

test('the leave step refuses an empty selection and an unknown code', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->post(route('setup.wizard.leave-types'), ['codes' => [], 'days' => []])
        ->assertSessionHasErrors('codes');

    $this->post(route('setup.wizard.leave-types'), ['codes' => ['NOPE'], 'days' => []])
        ->assertSessionHasErrors('codes.0');
});

test('the leave step does not duplicate a code the company already uses', function () {
    actingAsSuperAdmin();
    unfinishedTenant();
    LeaveType::factory()->create(['code' => 'VL', 'name' => 'Vacation Leave']);

    $this->post(route('setup.wizard.leave-types'), ['codes' => ['VL'], 'days' => []])
        ->assertSessionHasNoErrors();

    expect(LeaveType::where('code', 'VL')->count())->toBe(1);
});

// ── Step 4: recruitment ──────────────────────────────────────────────────────

test('the hiring step creates the blueprint pipeline as the default', function () {
    actingAsSuperAdmin();
    $organization = unfinishedTenant();

    $this->post(route('setup.wizard.recruitment'), ['blueprint' => 'standard'])
        ->assertSessionHasNoErrors();

    $pipeline = RecruitmentPipeline::with('stages')->firstOrFail();

    expect($pipeline->name)->toBe('Standard Hiring')
        ->and($pipeline->is_default)->toBeTrue()
        ->and($pipeline->stages->pluck('name')->all())
        ->toBe(['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'])
        ->and($pipeline->wonStage()->name)->toBe('Hired')
        ->and($pipeline->entryStage()->name)->toBe('Applied')
        ->and(CompanySetup::statuses($organization->refresh())['recruitment'])->toBe(CompanySetup::DONE);
});

test('the hiring step honours a name of the company own', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->post(route('setup.wizard.recruitment'), [
        'blueprint' => 'fast-track',
        'name' => 'Store Crew Hiring',
    ])->assertSessionHasNoErrors();

    expect(RecruitmentPipeline::value('name'))->toBe('Store Crew Hiring')
        ->and(RecruitmentPipeline::first()->stages)->toHaveCount(4);
});

test('the hiring step refuses a blueprint that is not on offer', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->post(route('setup.wizard.recruitment'), ['blueprint' => 'whatever-i-like'])
        ->assertSessionHasErrors('blueprint');

    expect(RecruitmentPipeline::count())->toBe(0);
});

test('a second pipeline does not steal the default from the first', function () {
    actingAsSuperAdmin();
    unfinishedTenant();
    seedDefaultPipeline();

    $this->post(route('setup.wizard.recruitment'), ['blueprint' => 'executive'])
        ->assertSessionHasNoErrors();

    expect(RecruitmentPipeline::where('is_default', true)->count())->toBe(1)
        ->and(RecruitmentPipeline::where('name', 'Executive Search')->value('is_default'))->toBeFalse();
});

// ── Step 5: performance framework ────────────────────────────────────────────

test('the appraisal step builds the framework, its criteria and the scales behind it', function () {
    actingAsSuperAdmin();
    $organization = unfinishedTenant();

    $this->post(route('setup.wizard.performance'), ['blueprint' => 'balanced'])
        ->assertSessionHasNoErrors();

    $template = ReviewTemplate::with('items')->firstOrFail();

    expect($template->name)->toBe('Balanced Appraisal')
        ->and($template->is_default)->toBeTrue()
        ->and($template->applies_to)->toBe('all')
        ->and(collect($template->sections)->pluck('key')->all())->toBe(['goals', 'competencies', 'conduct'])
        ->and($template->items)->toHaveCount(7)
        // Every line names a catalogue criterion — none is written into the
        // framework alone — and follows that criterion's own scale.
        ->and($template->items->whereNull('kpi_criterion_id'))->toHaveCount(0)
        ->and($template->items->whereNotNull('rating_scale_id'))->toHaveCount(0)
        ->and(KpiCriterion::count())->toBe(7)
        ->and(RatingScale::where('is_default', true)->value('name'))->toBe('5-point rating')
        ->and(CompanySetup::statuses($organization->refresh())['performance'])->toBe(CompanySetup::DONE);
});

test('a framework only creates the instruments it actually measures on', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->post(route('setup.wizard.performance'), ['blueprint' => 'results'])
        ->assertSessionHasNoErrors();

    expect(RatingScale::pluck('name')->sort()->values()->all())
        ->toBe(['Expectation rating', 'Goal attainment (%)'])
        ->and(KpiCriterion::count())->toBe(3);
});

test('adopting a framework reuses a scale and a criterion the company already has', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $scale = RatingScale::create([
        'name' => '5-point rating', 'description' => 'Ours', 'type' => 'numeric',
        'min' => 1, 'max' => 5, 'step' => 1, 'levels' => null, 'is_default' => true,
    ]);
    KpiCriterion::create([
        'name' => 'Quality of work', 'description' => 'Our own wording.',
        'weight' => 40, 'rating_scale_id' => $scale->id, 'is_active' => true, 'sort_order' => 1,
    ]);

    $this->post(route('setup.wizard.performance'), ['blueprint' => 'balanced'])
        ->assertSessionHasNoErrors();

    expect(RatingScale::where('name', '5-point rating')->count())->toBe(1)
        ->and(KpiCriterion::where('name', 'Quality of work')->count())->toBe(1)
        // The catalogue's wording wins over the blueprint's, as everywhere else.
        ->and(KpiCriterion::where('name', 'Quality of work')->value('description'))->toBe('Our own wording.');
});

test('the appraisal step refuses a blueprint that is not on offer', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->post(route('setup.wizard.performance'), ['blueprint' => 'my-own'])
        ->assertSessionHasErrors('blueprint');

    expect(ReviewTemplate::count())->toBe(0);
});

// ── Skipping and finishing ───────────────────────────────────────────────────

test('a skipped step is remembered, and the wizard resumes past it', function () {
    actingAsSuperAdmin();
    $organization = unfinishedTenant();

    $this->post(route('setup.wizard.skip'), ['step' => CompanySetup::COMPANY])
        ->assertSessionHasNoErrors();

    $organization->refresh();

    expect(CompanySetup::statuses($organization)['company'])->toBe(CompanySetup::SKIPPED)
        ->and(CompanySetup::resumeStep($organization))->toBe(CompanySetup::DEPARTMENTS);

    $this->get(route('setup.wizard.show'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('progress.steps.company', CompanySetup::SKIPPED)
            ->where('progress.resume', CompanySetup::DEPARTMENTS)
            ->etc());
});

test('a step that is not one of the five is refused', function () {
    actingAsSuperAdmin();
    unfinishedTenant();

    $this->post(route('setup.wizard.skip'), ['step' => 'payroll'])
        ->assertSessionHasErrors('step');
});

test('finishing closes setup and stops the redirect', function () {
    actingAsSuperAdmin();
    $organization = unfinishedTenant();

    $this->post(route('setup.wizard.finish'))->assertRedirect(route('dashboard'));

    expect($organization->refresh()->hasFinishedSetup())->toBeTrue();

    $this->get(route('dashboard'))->assertOk();
});

test('finishing twice keeps the first completion date', function () {
    actingAsSuperAdmin();
    $organization = unfinishedTenant();

    $this->post(route('setup.wizard.finish'));
    $first = $organization->refresh()->setup_completed_at;

    $this->post(route('setup.wizard.finish'))->assertRedirect(route('dashboard'));

    expect($organization->refresh()->setup_completed_at->equalTo($first))->toBeTrue();
});

test('the wizard stays reachable once setup is done, so a skipped step can be picked up', function () {
    actingAsSuperAdmin();

    $this->get(route('setup.wizard.show'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('progress.completed', true)->etc());
});

// ── Authorization & isolation ────────────────────────────────────────────────

test('each step is gated by the permission of the module it configures', function (string $route, array $payload, string $ability) {
    actingAsUserWith(['setup.company.manage']);
    unfinishedTenant();

    // Holding only the company-profile ability opens the wizard but not the step.
    $this->get(route('setup.wizard.show'))->assertOk();
    $this->post(route($route), $payload)->assertForbidden();

    actingAsUserWith(['setup.company.manage', $ability]);
    unfinishedTenant();

    $this->post(route($route), $payload)->assertSessionHasNoErrors();
})->with([
    ['setup.wizard.departments', ['codes' => ['HR'], 'custom' => []], 'setup.departments.manage'],
    ['setup.wizard.leave-types', ['codes' => ['VL'], 'days' => []], 'setup.leave-types.manage'],
    ['setup.wizard.recruitment', ['blueprint' => 'standard'], 'recruitment.configure-pipelines'],
    ['setup.wizard.performance', ['blueprint' => 'balanced'], 'setup.kpi.manage'],
]);

test('what a step creates lands in the acting tenant and nowhere else', function () {
    actingAsSuperAdmin();
    $mine = unfinishedTenant();
    $other = Organization::factory()->create();

    $this->post(route('setup.wizard.leave-types'), ['codes' => ['VL'], 'days' => []])
        ->assertSessionHasNoErrors();

    expect(LeaveType::where('organization_id', $mine->id)->count())->toBe(1);

    app(Tenancy::class)->runFor($other, function (): void {
        expect(LeaveType::count())->toBe(0);
    });
});

test('setup progress is the company own, not the session or the user', function () {
    seedPermissions();

    [$organization, $ownerRole] = OrganizationProvisioner::create('Two Owners Ltd');

    app(Tenancy::class)->set($organization);

    $first = User::factory()->create();
    $second = User::factory()->create();

    foreach ([$first, $second] as $user) {
        OrganizationProvisioner::addMember($organization, $user, default: true);
        $user->roles()->attach($ownerRole->id);
    }

    $this->actingAs($first)->post(route('setup.wizard.skip'), ['step' => CompanySetup::RECRUITMENT]);

    // The second owner picks up exactly where the first left off.
    $this->actingAs($second)->get(route('setup.wizard.show'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('progress.steps.recruitment', CompanySetup::SKIPPED)
            ->etc());

    expect(CompanySetup::statuses($organization->refresh())['recruitment'])->toBe(CompanySetup::SKIPPED);
});
