/**
 * FormData Helper Utilities
 *
 * Simplifies FormData parsing with type-safe validation
 */

import { type ZodSchema, z } from 'zod';
import { fail, type ActionFailure } from '@sveltejs/kit';

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
	| { success: false; errors: Record<string, string>; values: Record<string, any> }
> {
	// Convert FormData to plain object
	const data: Record<string, any> = {};
	const values: Record<string, any> = {};

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
): Promise<z.infer<T> | ActionFailure> {
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
