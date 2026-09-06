'use strict';

const { z } = require('zod');

const nullableText = z.string().trim().max(1000).nullable();
const nullableShortText = z.string().trim().max(255).nullable();
const nullableNumber = z.number().finite().nonnegative().nullable();
const confidence = z.number().finite().min(0).max(1).nullable();

const prescriptionItemSchema = z.object({
    raw_visible_text: z.string().trim().max(2000),
    brand_name_candidate: nullableShortText,
    generic_name_candidate: nullableShortText,
    strength_text: nullableShortText,
    dosage_form: nullableShortText,
    route: nullableShortText,
    dose_amount: nullableNumber,
    dose_unit: nullableShortText,
    frequency_text: nullableShortText,
    frequency_per_day: nullableNumber,
    duration_text: nullableShortText,
    duration_days: nullableNumber,
    quantity_text: nullableShortText,
    total_quantity: nullableNumber,
    instructions: nullableText,
    model_confidence: confidence,
    uncertain_fields: z.array(z.string().trim().max(80)).max(30)
}).strict();

const prescriptionSchema = z.object({
    document_type: z.string().trim().max(80),
    language: nullableShortText,
    printed_handwritten_or_mixed: z.enum(['printed', 'handwritten', 'mixed', 'unknown']),
    image_quality: z.enum(['good', 'fair', 'poor']),
    needs_retake: z.boolean(),
    retake_reason: nullableText,
    medicine_items: z.array(prescriptionItemSchema).max(30)
}).strict();

const packageSchema = z.object({
    raw_visible_text: z.string().trim().max(3000),
    brand_name_candidate: nullableShortText,
    generic_name_candidate: nullableShortText,
    strength_text: nullableShortText,
    dosage_form: nullableShortText,
    manufacturer_candidate: nullableShortText,
    registration_reference_candidate: nullableShortText,
    batch_number: nullableShortText,
    expiry_date: nullableShortText,
    printed_price: nullableNumber,
    currency: nullableShortText,
    model_confidence: confidence,
    uncertain_fields: z.array(z.string().trim().max(80)).max(30)
}).strict();

const nullableStringJson = { type: ['string', 'null'] };
const nullableNumberJson = { type: ['number', 'null'], minimum: 0 };
const confidenceJson = { type: ['number', 'null'], minimum: 0, maximum: 1 };

const prescriptionItemJsonSchema = {
    type: 'object', additionalProperties: false,
    properties: {
        raw_visible_text: { type: 'string' }, brand_name_candidate: nullableStringJson,
        generic_name_candidate: nullableStringJson, strength_text: nullableStringJson,
        dosage_form: nullableStringJson, route: nullableStringJson,
        dose_amount: nullableNumberJson, dose_unit: nullableStringJson,
        frequency_text: nullableStringJson, frequency_per_day: nullableNumberJson,
        duration_text: nullableStringJson, duration_days: nullableNumberJson,
        quantity_text: nullableStringJson, total_quantity: nullableNumberJson,
        instructions: nullableStringJson, model_confidence: confidenceJson,
        uncertain_fields: { type: 'array', items: { type: 'string' } }
    },
    required: ['raw_visible_text', 'brand_name_candidate', 'generic_name_candidate', 'strength_text',
        'dosage_form', 'route', 'dose_amount', 'dose_unit', 'frequency_text', 'frequency_per_day',
        'duration_text', 'duration_days', 'quantity_text', 'total_quantity', 'instructions',
        'model_confidence', 'uncertain_fields']
};

const prescriptionJsonSchema = {
    type: 'object', additionalProperties: false,
    properties: {
        document_type: { type: 'string' }, language: nullableStringJson,
        printed_handwritten_or_mixed: { type: 'string', enum: ['printed', 'handwritten', 'mixed', 'unknown'] },
        image_quality: { type: 'string', enum: ['good', 'fair', 'poor'] },
        needs_retake: { type: 'boolean' }, retake_reason: nullableStringJson,
        medicine_items: { type: 'array', items: prescriptionItemJsonSchema }
    },
    required: ['document_type', 'language', 'printed_handwritten_or_mixed', 'image_quality',
        'needs_retake', 'retake_reason', 'medicine_items']
};

const packageJsonSchema = {
    type: 'object', additionalProperties: false,
    properties: {
        raw_visible_text: { type: 'string' }, brand_name_candidate: nullableStringJson,
        generic_name_candidate: nullableStringJson, strength_text: nullableStringJson,
        dosage_form: nullableStringJson, manufacturer_candidate: nullableStringJson,
        registration_reference_candidate: nullableStringJson, batch_number: nullableStringJson,
        expiry_date: nullableStringJson, printed_price: nullableNumberJson, currency: nullableStringJson,
        model_confidence: confidenceJson,
        uncertain_fields: { type: 'array', items: { type: 'string' } }
    },
    required: ['raw_visible_text', 'brand_name_candidate', 'generic_name_candidate', 'strength_text',
        'dosage_form', 'manufacturer_candidate', 'registration_reference_candidate', 'batch_number',
        'expiry_date', 'printed_price', 'currency', 'model_confidence', 'uncertain_fields']
};

function extractionContract(mode) {
    return mode === 'prescription'
        ? { schema: prescriptionSchema, jsonSchema: prescriptionJsonSchema }
        : { schema: packageSchema, jsonSchema: packageJsonSchema };
}

module.exports = { extractionContract, prescriptionSchema, packageSchema };
