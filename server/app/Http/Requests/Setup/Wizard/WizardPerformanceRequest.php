<?php

namespace App\Http\Requests\Setup\Wizard;

use App\Support\Setup\SetupBlueprints;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The wizard's appraisal step: which framework the company reviews its people
 * against, under a name of its own. A framework is a whole apparatus — sections,
 * weights, a criteria catalogue and the instruments it measures on (ADR 0028) —
 * so it is chosen rather than described here, and resolved from
 * {@see SetupBlueprints} server-side. Every part of it is editable afterwards
 * under Company Setup → Performance Framework.
 */
class WizardPerformanceRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'blueprint' => ['required', 'string', Rule::in(array_column(SetupBlueprints::frameworks(), 'key'))],
            'name' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'blueprint.required' => 'Pick a framework, or skip this step.',
            'blueprint.in' => 'Pick a framework, or skip this step.',
        ];
    }
}
