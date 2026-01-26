<script lang="ts">
	import Listbox, { type ListboxOption } from './Listbox.svelte';

	interface CountryCode {
		code: string;
		name: string;
		dial: string;
	}

	interface Props {
		name: string;
		label: string;
		value?: string;
		error?: string;
		required?: boolean;
		disabled?: boolean;
		onblur?: (value: string) => void;
	}

	let {
		name,
		label,
		value = '',
		error,
		required = false,
		disabled = false,
		onblur
	}: Props = $props();

	// Convert country code to flag emoji
	function getFlag(code: string): string {
		const codePoints = [...code.toUpperCase()].map(
			(char) => 0x1f1e6 + char.charCodeAt(0) - 65
		);
		return String.fromCodePoint(...codePoints);
	}

	// Country codes with dial prefixes (most common first, then alphabetical)
	const countryCodes: CountryCode[] = [
		{ code: 'IT', name: 'Italia', dial: '+39' },
		{ code: 'DE', name: 'Germania', dial: '+49' },
		{ code: 'FR', name: 'Francia', dial: '+33' },
		{ code: 'ES', name: 'Spagna', dial: '+34' },
		{ code: 'GB', name: 'Regno Unito', dial: '+44' },
		{ code: 'US', name: 'Stati Uniti', dial: '+1' },
		{ code: 'CH', name: 'Svizzera', dial: '+41' },
		{ code: 'AT', name: 'Austria', dial: '+43' },
		{ code: 'BE', name: 'Belgio', dial: '+32' },
		{ code: 'NL', name: 'Paesi Bassi', dial: '+31' },
		{ code: 'PT', name: 'Portogallo', dial: '+351' },
		{ code: 'PL', name: 'Polonia', dial: '+48' },
		{ code: 'RO', name: 'Romania', dial: '+40' },
		{ code: 'GR', name: 'Grecia', dial: '+30' },
		{ code: 'SE', name: 'Svezia', dial: '+46' },
		{ code: 'NO', name: 'Norvegia', dial: '+47' },
		{ code: 'DK', name: 'Danimarca', dial: '+45' },
		{ code: 'FI', name: 'Finlandia', dial: '+358' },
		{ code: 'IE', name: 'Irlanda', dial: '+353' },
		{ code: 'CZ', name: 'Repubblica Ceca', dial: '+420' },
		{ code: 'HU', name: 'Ungheria', dial: '+36' },
		{ code: 'SK', name: 'Slovacchia', dial: '+421' },
		{ code: 'SI', name: 'Slovenia', dial: '+386' },
		{ code: 'HR', name: 'Croazia', dial: '+385' },
		{ code: 'BG', name: 'Bulgaria', dial: '+359' },
		{ code: 'RS', name: 'Serbia', dial: '+381' },
		{ code: 'BA', name: 'Bosnia ed Erzegovina', dial: '+387' },
		{ code: 'ME', name: 'Montenegro', dial: '+382' },
		{ code: 'MK', name: 'Macedonia del Nord', dial: '+389' },
		{ code: 'AL', name: 'Albania', dial: '+355' },
		{ code: 'XK', name: 'Kosovo', dial: '+383' },
		{ code: 'UA', name: 'Ucraina', dial: '+380' },
		{ code: 'RU', name: 'Russia', dial: '+7' },
		{ code: 'BY', name: 'Bielorussia', dial: '+375' },
		{ code: 'MD', name: 'Moldova', dial: '+373' },
		{ code: 'LT', name: 'Lituania', dial: '+370' },
		{ code: 'LV', name: 'Lettonia', dial: '+371' },
		{ code: 'EE', name: 'Estonia', dial: '+372' },
		{ code: 'MT', name: 'Malta', dial: '+356' },
		{ code: 'CY', name: 'Cipro', dial: '+357' },
		{ code: 'LU', name: 'Lussemburgo', dial: '+352' },
		{ code: 'IS', name: 'Islanda', dial: '+354' },
		{ code: 'TR', name: 'Turchia', dial: '+90' },
		{ code: 'MA', name: 'Marocco', dial: '+212' },
		{ code: 'TN', name: 'Tunisia', dial: '+216' },
		{ code: 'EG', name: 'Egitto', dial: '+20' },
		{ code: 'IL', name: 'Israele', dial: '+972' },
		{ code: 'AE', name: 'Emirati Arabi Uniti', dial: '+971' },
		{ code: 'SA', name: 'Arabia Saudita', dial: '+966' },
		{ code: 'IN', name: 'India', dial: '+91' },
		{ code: 'CN', name: 'Cina', dial: '+86' },
		{ code: 'JP', name: 'Giappone', dial: '+81' },
		{ code: 'KR', name: 'Corea del Sud', dial: '+82' },
		{ code: 'AU', name: 'Australia', dial: '+61' },
		{ code: 'NZ', name: 'Nuova Zelanda', dial: '+64' },
		{ code: 'BR', name: 'Brasile', dial: '+55' },
		{ code: 'AR', name: 'Argentina', dial: '+54' },
		{ code: 'MX', name: 'Messico', dial: '+52' },
		{ code: 'CA', name: 'Canada', dial: '+1' },
		{ code: 'ZA', name: 'Sudafrica', dial: '+27' }
	];

	// Convert to Listbox options format with flags
	const prefixOptions: ListboxOption[] = countryCodes.map((c) => ({
		value: c.dial,
		label: `${getFlag(c.code)} ${c.name} (${c.dial})`
	}));

	// Parse initial value to extract prefix and number
	function parsePhoneNumber(phone: string): { prefix: string; number: string } {
		if (!phone) return { prefix: '+39', number: '' };

		// Try to match a known prefix
		for (const country of countryCodes) {
			if (phone.startsWith(country.dial)) {
				const numberPart = phone.slice(country.dial.length).replace(/\s/g, '');
				return { prefix: country.dial, number: numberPart };
			}
		}

		// If no prefix found but starts with +, try to extract it
		if (phone.startsWith('+')) {
			const match = phone.match(/^(\+\d{1,4})\s*(.*)$/);
			if (match) {
				return { prefix: match[1], number: match[2].replace(/\s/g, '') };
			}
		}

		// Default: assume Italian prefix
		return { prefix: '+39', number: phone.replace(/\s/g, '') };
	}

	// Internal state
	let { prefix: initialPrefix, number: initialNumber } = parsePhoneNumber(value);
	let selectedPrefix = $state(initialPrefix);
	let phoneNumber = $state(initialNumber);
	let lastExternalValue = $state(value);

	// Sync with external value when it changes
	$effect(() => {
		if (value !== lastExternalValue) {
			lastExternalValue = value;
			const parsed = parsePhoneNumber(value);
			selectedPrefix = parsed.prefix;
			phoneNumber = parsed.number;
		}
	});

	// Compute full phone number for the hidden input
	let fullPhoneNumber = $derived(phoneNumber ? `${selectedPrefix}${phoneNumber}` : '');

	function handlePrefixChange(newPrefix: string) {
		selectedPrefix = newPrefix;
	}

	function handleNumberInput(event: Event) {
		const target = event.target as HTMLInputElement;
		// Only allow digits
		phoneNumber = target.value.replace(/\D/g, '');
	}

	function handleBlur() {
		if (onblur) {
			onblur(fullPhoneNumber);
		}
	}

	// Get display label for selected prefix
	let selectedPrefixLabel = $derived(
		countryCodes.find((c) => c.dial === selectedPrefix)?.code || ''
	);
</script>

<div class="mb-6">
	<label for="{name}-number" class="label text-gray-700">
		{label}
		{#if required}
			<span class="required">*</span>
		{/if}
	</label>

	<div class="phone-input-row">
		<!-- Country prefix selector -->
		<div class="prefix-wrapper">
			<Listbox
				name="{name}-prefix"
				label=""
				options={prefixOptions}
				value={selectedPrefix}
				placeholder="+39"
				searchable={true}
				searchPlaceholder="Cerca paese..."
				{disabled}
				onchange={handlePrefixChange}
				onblur={handleBlur}
			/>
		</div>

		<!-- Phone number input -->
		<div class="number-wrapper">
			<input
				type="tel"
				id="{name}-number"
				value={phoneNumber}
				oninput={handleNumberInput}
				onblur={handleBlur}
				{disabled}
				placeholder="333 1234567"
				class="input text-gray-900 {error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} {disabled ? 'bg-gray-100 cursor-not-allowed' : ''}"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby={error ? `${name}-error` : undefined}
			/>
		</div>
	</div>

	<!-- Hidden input with the full phone number for form submission -->
	<input type="hidden" {name} value={fullPhoneNumber} />

	{#if error}
		<p id="{name}-error" class="error-message">{error}</p>
	{/if}
</div>

<style>
	@reference "tailwindcss";

	.phone-input-row {
		@apply flex gap-2 items-stretch;
	}

	.prefix-wrapper {
		@apply w-52 flex-shrink-0;
	}

	/* Remove all margins from nested Listbox container */
	.prefix-wrapper :global(> div) {
		@apply mb-0;
	}

	/* Make listbox button match input height */
	.prefix-wrapper :global(.listbox-button) {
		min-height: 68px;
	}

	.number-wrapper {
		@apply flex-1;
	}

	.error-message {
		@apply text-amber-300 text-base mt-2;
	}

	.required {
		@apply text-amber-400;
	}
</style>
