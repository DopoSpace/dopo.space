/**
 * FormData Helper Utilities
 *
 * Simplifies FormData parsing with type-safe validation
 */

import { type ZodSchema, z } from 'zod';
import { fail, type ActionFailure } from '@sveltejs/kit';

/** Represents a value from FormData (string or File) */
type FormDataValue = FormDataEntryValue;

/** Represents parsed form data with proper typing */
type ParsedFormData = Record<string, FormDataValue | FormDataValue[]>;

/**
 * Parse and validate FormData with Zod schema
 * @param formData - The FormData to parse
 * @param schema - Zod schema for validation
 * @returns Validated data or ActionFailure
 */
export async function parseFormData<T extends ZodSchema>(
	formData: FormData,
	schema: T
): Promise<
	| { success: true; data: z.infer<T> }
	| { success: false; errors: Record<string, string>; values: Record<string, unknown> }
> {
	// Convert FormData to plain object
	const data: ParsedFormData = {};
	const values: Record<string, FormDataValue> = {};

	formData.forEach((value, key) => {
		// Store raw values for error response
		values[key] = value;

		// Handle multiple values with same key (checkboxes, multi-select)
		if (data[key]) {
			if (Array.isArray(data[key])) {
				data[key].push(value);
			} else {
				data[key] = [data[key], value];
			}
		} else {
			data[key] = value;
		}
	});

	// Validate with Zod
	const result = schema.safeParse(data);

	if (!result.success) {
		// Format Zod errors into a simple object
		const errors: Record<string, string> = {};
		result.error.issues.forEach((issue) => {
			const path = issue.path.join('.');
			errors[path] = issue.message;
		});

		return {
			success: false,
			errors,
			values
		};
	}

	return {
		success: true,
		data: result.data
	};
}

/**
 * Parse FormData and return ActionFailure on validation error
 * @param formData - The FormData to parse
 * @param schema - Zod schema for validation
 * @returns Validated data or throws ActionFailure
 */
export async function parseFormDataOrFail<T extends ZodSchema>(
	formData: FormData,
	schema: T
): Promise<z.infer<T> | ActionFailure<{ errors: Record<string, string>; values: Record<string, unknown> }>> {
	const result = await parseFormData(formData, schema);

	if (!result.success) {
		return fail(400, { errors: result.errors, values: result.values });
	}

	return result.data;
}

/**
 * Get a single value from FormData with type conversion
 * @param formData - The FormData object
 * @param key - The key to get
 * @param defaultValue - Optional default value if key not found
 * @returns The value or default
 */
export function getFormValue(
	formData: FormData,
	key: string,
	defaultValue: string = ''
): string {
	const value = formData.get(key);
	return value ? String(value) : defaultValue;
}

/**
 * Get a boolean value from FormData (checkbox)
 * @param formData - The FormData object
 * @param key - The key to get
 * @returns True if checkbox is checked, false otherwise
 */
export function getFormBoolean(formData: FormData, key: string): boolean {
	const value = formData.get(key);
	return value === 'on' || value === 'true' || value === '1';
}

/**
 * Get a number value from FormData
 * @param formData - The FormData object
 * @param key - The key to get
 * @param defaultValue - Optional default value if key not found or invalid
 * @returns The parsed number or default
 */
export function getFormNumber(
	formData: FormData,
	key: string,
	defaultValue: number = 0
): number {
	const value = formData.get(key);
	if (!value) return defaultValue;

	const parsed = Number(value);
	return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Custom error class for strict form parsing
 */
export class FormParseError extends Error {
	constructor(
		message: string,
		public readonly field: string
	) {
		super(message);
		this.name = 'FormParseError';
	}
}

/**
 * Get a number value from FormData with strict validation
 * Unlike getFormNumber, this throws an error for invalid/missing values
 * @param formData - The FormData object
 * @param key - The key to get
 * @throws FormParseError if value is missing or not a valid number
 * @returns The parsed number
 */
export function getFormNumberStrict(formData: FormData, key: string): number {
	const value = formData.get(key);

	if (value === null || value === undefined) {
		throw new FormParseError(`Missing required field: ${key}`, key);
	}

	if (typeof value !== 'string') {
		throw new FormParseError(`Field ${key} must be a string value, got ${typeof value}`, key);
	}

	if (value.trim() === '') {
		throw new FormParseError(`Field ${key} cannot be empty`, key);
	}

	const parsed = Number(value);

	if (isNaN(parsed)) {
		throw new FormParseError(`Field ${key} must be a valid number, got "${value}"`, key);
	}

	return parsed;
}

/**
 * Get a string value from FormData with strict validation
 * Unlike getFormValue, this throws an error for missing values
 * @param formData - The FormData object
 * @param key - The key to get
 * @throws FormParseError if value is missing or empty
 * @returns The string value
 */
export function getFormValueStrict(formData: FormData, key: string): string {
	const value = formData.get(key);

	if (value === null || value === undefined) {
		throw new FormParseError(`Missing required field: ${key}`, key);
	}

	if (typeof value !== 'string') {
		throw new FormParseError(`Field ${key} must be a string value, got ${typeof value}`, key);
	}

	if (value.trim() === '') {
		throw new FormParseError(`Field ${key} cannot be empty`, key);
	}

	return value;
}
