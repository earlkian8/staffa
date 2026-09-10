<?php

namespace App\Http\Requests\Setup\Wizard;

use App\Support\Setup\SetupBlueprints;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The wizard's hiring step: which process shape the company starts from, under a
 * name of its own. The stages themselves are resolved from
 * {@see SetupBlueprints} rather than posted, so the open/won/lost semantics
 * recruitment depends on (ADR 0029) are guaranteed correct on the way in. Stages
 * are fully editable afterwards under Company Setup → Recruitment Pipelines.
 */
class WizardRecruitmentRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'blueprint' => ['required', 'string', Rule::in(array_column(SetupBlueprints::pipelines(), 'key'))],
            'name' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'blueprint.required' => 'Pick a hiring process, or skip this step.',
            'blueprint.in' => 'Pick a hiring process, or skip this step.',
        ];
    }
}
