<?php

namespace App\Http\Requests\Setup\Wizard;

use App\Support\Setup\SetupBlueprints;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The wizard's leave step: which kinds of leave the company grants, and how many
 * days each carries. Only the entitlement is the owner's to set here — the name,
 * code, colour and policy flags come from {@see SetupBlueprints}, because a
 * statutory leave is not a thing a client should be able to redefine on the way
 * in. Everything else about a type is editable afterwards under Company Setup.
 */
class WizardLeaveTypesRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $codes = array_column(SetupBlueprints::leaveTypes(), 'code');

        return [
            'codes' => ['required', 'array', 'min:1'],
            'codes.*' => ['string', Rule::in($codes)],

            // Keyed by blueprint code. Bounds match LeaveTypeRequest so the
            // wizard cannot create a type the leave-types screen would reject.
            'days' => ['present', 'array'],
            'days.*' => ['numeric', 'min:0', 'max:365'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'codes.required' => 'Pick at least one kind of leave, or skip this step.',
            'codes.min' => 'Pick at least one kind of leave, or skip this step.',
        ];
    }

    /**
     * The days the owner settled on, as blueprint code => entitlement. Days for a
     * type that was not ticked are dropped rather than validated — an untouched
     * slider on an unticked row is not an error.
     *
     * @return array<string, float>
     */
    public function days(): array
    {
        $codes = $this->validated('codes');
        $days = [];

        foreach ((array) $this->validated('days') as $code => $value) {
            if (in_array($code, $codes, true)) {
                $days[(string) $code] = (float) $value;
            }
        }

        return $days;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'codes' => array_values(array_unique(array_map(strval(...), (array) $this->input('codes', [])))),
            'days' => array_filter(
                (array) $this->input('days', []),
                fn (mixed $value): bool => is_numeric($value),
            ),
        ]);
    }
}
