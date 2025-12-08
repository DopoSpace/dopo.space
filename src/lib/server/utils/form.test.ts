/**
 * Tests for Form Utilities
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { parseFormData, parseFormDataOrFail, getFormValue, getFormBoolean, getFormNumber } from './form';

describe('parseFormData', () => {
	it('should parse valid form data', async () => {
		const schema = z.object({
			email: z.string().email(),
			name: z.string()
		});

		const formData = new FormData();
		formData.append('email', 'test@example.com');
		formData.append('name', 'John Doe');

		const result = await parseFormData(formData, schema);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.email).toBe('test@example.com');
			expect(result.data.name).toBe('John Doe');
		}
	});

	it('should return errors for invalid data', async () => {
		const schema = z.object({
			email: z.string().email(),
			age: z.number()
		});

		const formData = new FormData();
		formData.append('email', 'invalid-email');
		formData.append('age', 'not-a-number');

		const result = await parseFormData(formData, schema);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors).toHaveProperty('email');
			expect(result.errors).toHaveProperty('age');
		}
	});

	it('should handle multiple values as array', async () => {
		const schema = z.object({
			tags: z.array(z.string())
		});

		const formData = new FormData();
		formData.append('tags', 'tag1');
		formData.append('tags', 'tag2');
		formData.append('tags', 'tag3');

		const result = await parseFormData(formData, schema);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.tags).toEqual(['tag1', 'tag2', 'tag3']);
		}
	});

	it('should return values on error', async () => {
		const schema = z.object({
			email: z.string().email()
		});

		const formData = new FormData();
		formData.append('email', 'invalid');

		const result = await parseFormData(formData, schema);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.values.email).toBe('invalid');
		}
	});
});

describe('parseFormDataOrFail', () => {
	it('should return data on success', async () => {
		const schema = z.object({
			name: z.string()
		});

		const formData = new FormData();
		formData.append('name', 'Test');

		const result = await parseFormDataOrFail(formData, schema);

		// Type guard: if it has 'status', it's an ActionFailure
		if ('status' in result) {
			throw new Error('Expected success but got ActionFailure');
		}
		expect(result.name).toBe('Test');
	});

	it('should return ActionFailure on error', async () => {
		const schema = z.object({
			email: z.string().email()
		});

		const formData = new FormData();
		formData.append('email', 'invalid');

		const result = await parseFormDataOrFail(formData, schema);

		// Type guard: check if it's an ActionFailure
		expect('status' in result).toBe(true);
		if ('status' in result) {
			expect(result.status).toBe(400);
		}
	});
});

describe('getFormValue', () => {
	it('should return string value', () => {
		const formData = new FormData();
		formData.append('name', 'John');

		const value = getFormValue(formData, 'name');
		expect(value).toBe('John');
	});

	it('should return default value when key missing', () => {
		const formData = new FormData();

		const value = getFormValue(formData, 'missing', 'default');
		expect(value).toBe('default');
	});

	it('should return empty string as default when not specified', () => {
		const formData = new FormData();

		const value = getFormValue(formData, 'missing');
		expect(value).toBe('');
	});

	it('should convert File to string', () => {
		const formData = new FormData();
		const file = new File(['content'], 'test.txt');
		formData.append('file', file);

		const value = getFormValue(formData, 'file');
		expect(typeof value).toBe('string');
	});
});

describe('getFormBoolean', () => {
	it('should return true for "on" value (checkbox checked)', () => {
		const formData = new FormData();
		formData.append('accept', 'on');

		expect(getFormBoolean(formData, 'accept')).toBe(true);
	});

	it('should return true for "true" value', () => {
		const formData = new FormData();
		formData.append('accept', 'true');

		expect(getFormBoolean(formData, 'accept')).toBe(true);
	});

	it('should return true for "1" value', () => {
		const formData = new FormData();
		formData.append('accept', '1');

		expect(getFormBoolean(formData, 'accept')).toBe(true);
	});

	it('should return false for missing key (unchecked checkbox)', () => {
		const formData = new FormData();

		expect(getFormBoolean(formData, 'accept')).toBe(false);
	});

	it('should return false for "false" value', () => {
		const formData = new FormData();
		formData.append('accept', 'false');

		expect(getFormBoolean(formData, 'accept')).toBe(false);
	});

	it('should return false for "0" value', () => {
		const formData = new FormData();
		formData.append('accept', '0');

		expect(getFormBoolean(formData, 'accept')).toBe(false);
	});

	it('should return false for other values', () => {
		const formData = new FormData();
		formData.append('accept', 'maybe');

		expect(getFormBoolean(formData, 'accept')).toBe(false);
	});
});

describe('getFormNumber', () => {
	it('should parse valid number', () => {
		const formData = new FormData();
		formData.append('age', '25');

		expect(getFormNumber(formData, 'age')).toBe(25);
	});

	it('should parse decimal numbers', () => {
		const formData = new FormData();
		formData.append('price', '19.99');

		expect(getFormNumber(formData, 'price')).toBe(19.99);
	});

	it('should parse negative numbers', () => {
		const formData = new FormData();
		formData.append('temp', '-10');

		expect(getFormNumber(formData, 'temp')).toBe(-10);
	});

	it('should return 0 for zero value', () => {
		const formData = new FormData();
		formData.append('count', '0');

		expect(getFormNumber(formData, 'count')).toBe(0);
	});

	it('should return default for invalid number', () => {
		const formData = new FormData();
		formData.append('age', 'not-a-number');

		expect(getFormNumber(formData, 'age', 18)).toBe(18);
	});

	it('should return default for missing key', () => {
		const formData = new FormData();

		expect(getFormNumber(formData, 'missing', 42)).toBe(42);
	});

	it('should return 0 as default when not specified', () => {
		const formData = new FormData();

		expect(getFormNumber(formData, 'missing')).toBe(0);
	});
});
