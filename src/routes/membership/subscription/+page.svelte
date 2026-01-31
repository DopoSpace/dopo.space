<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import TextContainer from '$lib/components/TextContainer.svelte';
	import AddressAutocomplete, { type AddressResult } from '$lib/components/forms/AddressAutocomplete.svelte';
	import PhoneInput from '$lib/components/forms/PhoneInput.svelte';
	import Listbox from '$lib/components/forms/Listbox.svelte';
	import DatePicker from '$lib/components/forms/DatePicker.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { validateField, type ValidationContext } from '$lib/utils/form-validation';
	import { calculateAge } from '$lib/utils/date';
	import { SystemState } from '$lib/types/membership';
	import {
		trackLoginSuccess,
		trackProfileFormStart,
		trackProfileFormSubmit
	} from '$lib/analytics';
	import * as m from '$lib/paraglide/messages';
	import type { PageData } from './$types';

	// Type for profile form errors
	type ProfileFormErrors = {
		_form?: string;
		firstName?: string;
		lastName?: string;
		birthDate?: string;
		nationality?: string;
		birthProvince?: string;
		birthCity?: string;
		hasForeignTaxCode?: string;
		gender?: string;
		taxCode?: string;
		phone?: string;
		privacyConsent?: string;
		dataConsent?: string;
	};

	// Type for form values
	type ProfileFormValues = {
		firstName?: string;
		lastName?: string;
		birthDate?: string;
		nationality?: string;
		birthProvince?: string;
		birthCity?: string;
		hasForeignTaxCode?: boolean;
		gender?: string;
		taxCode?: string;
		phone?: string;
		privacyConsent?: boolean;
		dataConsent?: boolean;
		newsletterConsent?: boolean;
	};

	type SubscriptionFormData = {
		success?: boolean;
		errors?: ProfileFormErrors;
		values?: ProfileFormValues;
	} | null;

	let { data, form }: { data: PageData; form: SubscriptionFormData } = $props();
	let loading = $state(false);
	let showSuccessToast = $state(false);
	let showErrorToast = $state(false);

	// Form is collapsed by default if profile is already complete
	let formExpanded = $state(!data.profileComplete);

	// Track form interaction (only once per session)
	let formInteractionTracked = $state(false);

	// Track login success if user just came from verification
	onMount(() => {
		if (typeof document !== 'undefined' && document.referrer.includes('/auth/verify')) {
			trackLoginSuccess();
		}
	});

	function handleFormInteraction() {
		if (!formInteractionTracked) {
			formInteractionTracked = true;
			trackProfileFormStart();
		}
	}

	// Show toast when form submission succeeds or fails
	$effect(() => {
		if (form?.success) {
			showSuccessToast = true;
			showErrorToast = false;
		} else if (form?.errors) {
			showErrorToast = true;
			showSuccessToast = false;
		}
	});

	// Client-side validation errors (separate from server-side form errors)
	let clientErrors = $state<ProfileFormErrors>({});

	// Track nationality for conditional rendering (initialized from form/data, then user-controlled)
	let nationalityOverride = $state<string | null>(null);
	let hasForeignTaxCodeOverride = $state<boolean | null>(null);
	let genderOverride = $state<string | null>(null);

	// Birth city/province fields (can be populated by autocomplete)
	let birthCityOverride = $state<string | null>(null);
	let birthProvinceOverride = $state<string | null>(null);

	// Track birth date for validation context
	let birthDateOverride = $state<string | null>(null);

	// Override state for firstName and lastName (to preserve typed values across re-renders)
	let firstNameOverride = $state<string | null>(null);
	let lastNameOverride = $state<string | null>(null);

	// Newsletter consent - computed from form values (on validation failure) or user data
	let newsletterConsent = $derived(form?.values?.newsletterConsent ?? data.user.newsletterSubscribed ?? false);

	// Derived values for birth city/province/date fields
	let birthCity = $derived(birthCityOverride ?? form?.values?.birthCity ?? data.profile?.birthCity ?? '');
	let birthProvince = $derived(birthProvinceOverride ?? form?.values?.birthProvince ?? data.profile?.birthProvince ?? '');
	let birthDate = $derived(birthDateOverride ?? form?.values?.birthDate ?? formatDateForInput(data.profile?.birthDate));

	// Derived values for firstName and lastName
	let firstName = $derived(firstNameOverride ?? form?.values?.firstName ?? data.profile?.firstName ?? '');
	let lastName = $derived(lastNameOverride ?? form?.values?.lastName ?? data.profile?.lastName ?? '');

	// Handle birth city selection from autocomplete
	function handleBirthCitySelect(result: AddressResult) {
		if (result.city) birthCityOverride = result.city;
		if (result.province) birthProvinceOverride = result.province;
	}

	// Handle nationality change - clear birth city when nationality changes
	function handleNationalityChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		nationalityOverride = target.value;
		birthCityOverride = '';
		birthProvinceOverride = '';
	}

	// Use override if set, otherwise fall back to form/data values
	let nationality = $derived(
		nationalityOverride ?? form?.values?.nationality ?? data.profile?.nationality ?? ''
	);
	let hasForeignTaxCode = $derived(
		hasForeignTaxCodeOverride ?? form?.values?.hasForeignTaxCode ?? data.profile?.hasForeignTaxCode ?? false
	);
	let gender = $derived(
		genderOverride ?? form?.values?.gender ?? data.profile?.gender ?? ''
	);

	// Check if user is under 16
	let isUnder16 = $derived(calculateAge(birthDate) < 16);

	// Computed states
	let isItalian = $derived(nationality === 'IT');
	let isForeigner = $derived(nationality === 'XX');
	let showTaxCodeField = $derived(!isForeigner || hasForeignTaxCode);

	// Build validation context from current form state
	let validationContext = $derived<ValidationContext>({
		nationality,
		hasForeignTaxCode,
		birthDate,
		firstName,
		lastName
	});

	// Handle field blur validation
	function handleFieldBlur(fieldName: keyof ProfileFormErrors, value: string) {
		const result = validateField(fieldName, value, validationContext);
		if (!result.valid && result.error) {
			clientErrors[fieldName] = result.error;
		} else {
			delete clientErrors[fieldName];
			clientErrors = { ...clientErrors };
		}
	}

	// Handle checkbox blur validation
	function handleCheckboxBlur(fieldName: keyof ProfileFormErrors, checked: boolean) {
		const result = validateField(fieldName, checked ? 'true' : '', validationContext);
		if (!result.valid && result.error) {
			clientErrors[fieldName] = result.error;
		} else {
			delete clientErrors[fieldName];
			clientErrors = { ...clientErrors };
		}
	}

	// Get error for a field (prefer server-side error, fall back to client-side)
	function getFieldError(fieldName: keyof ProfileFormErrors): string | undefined {
		return form?.errors?.[fieldName] ?? clientErrors[fieldName];
	}

	// Format birth date for input
	function formatDateForInput(date: Date | string | null | undefined): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		if (isNaN(d.getTime())) return '';
		return d.toISOString().split('T')[0];
	}
</script>

<svelte:head>
	<title>{m.subscription_title()} - Dopo Space</title>
</svelte:head>

<PublicPageLayout>
	<div class="subscription-page">
		<TextContainer>
			<!-- Header -->
			<h1>{m.subscription_title()}</h1>
			<!-- Subtitle only for states without status cards -->
			{#if data.membershipState === SystemState.S0_NO_MEMBERSHIP}
				<p>{m.subscription_subtitle_no_membership()}</p>
			{:else if data.membershipState === SystemState.S1_PROFILE_COMPLETE}
				<p>{@html m.subscription_subtitle_profile_complete().replace('Procedi al pagamento', '<a href="/membership/checkout">' + m.subscription_proceed_payment() + '</a>')}</p>
			{:else if data.membershipState === SystemState.S2_PROCESSING_PAYMENT}
				<p>{m.subscription_subtitle_processing()}</p>
			{:else if data.membershipState === SystemState.S7_CANCELED}
				<p>{m.subscription_subtitle_canceled()}</p>
			{/if}
			<!-- States S3, S4, S5, S6 show status text instead of subtitle -->
			{#if data.membershipState === SystemState.S4_AWAITING_NUMBER}
				<p>{m.subscription_status_payment_completed_text()}. {m.subscription_status_payment_completed_note()}</p>
			{:else if data.membershipState === SystemState.S5_ACTIVE}
				<p>
					{m.subscription_status_active_text()}.
					{#if data.membershipNumber}
						{m.subscription_status_number({ number: data.membershipNumber })}.
					{/if}
					{m.subscription_status_active_welcome()}
				</p>
			{:else if data.membershipState === SystemState.S3_PAYMENT_FAILED}
				<p>{m.subscription_status_failed_text()}. <a href="/membership/checkout">{m.subscription_status_failed_retry()}</a> {m.subscription_status_failed_note()}</p>
			{:else if data.membershipState === SystemState.S6_EXPIRED}
				<p>{m.subscription_status_expired_text()}. <a href="/membership/checkout">{m.subscription_status_expired_renew()}</a> {m.subscription_status_expired_note()}</p>
			{/if}

			<!-- Collapsible Profile Section (only collapsible if profile is already complete) -->
			{#if data.profileComplete}
				<button
					type="button"
					class="profile-toggle {formExpanded ? 'expanded' : ''}"
					onclick={() => formExpanded = !formExpanded}
					aria-expanded={formExpanded}
					aria-controls="profile-form"
				>
					<div class="profile-toggle-icon">
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
						</svg>
					</div>
					<div class="profile-toggle-content">
						<span class="profile-toggle-label">{m.subscription_profile_toggle_title()}</span>
						<span class="profile-toggle-value">{data.profile?.firstName} {data.profile?.lastName}</span>
					</div>
					<div class="profile-toggle-action">
						<span class="profile-toggle-action-text">{formExpanded ? m.common_close() : m.common_edit()}</span>
						<svg
							class="profile-toggle-chevron {formExpanded ? 'expanded' : ''}"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
						</svg>
					</div>
				</button>
			{/if}

			{#if formExpanded || !data.profileComplete}
			<form
				id="profile-form"
				method="POST"
				onfocusin={handleFormInteraction}
				use:enhance={() => {
					loading = true;
					clientErrors = {};
					return async ({ update, result }) => {
						await update({ invalidateAll: true, reset: false });
						loading = false;
						trackProfileFormSubmit(result.type === 'success' || (result.type === 'redirect'));
						// Reset overrides on success so derived values use fresh data from server
						if (result.type === 'success' || result.type === 'redirect') {
							firstNameOverride = null;
							lastNameOverride = null;
						}
					};
				}}
			>
				{#if form?.errors?._form}
					<div class="warning-box">
						<p>{form.errors._form}</p>
					</div>
				{/if}

				<!-- Dati Personali -->
				<div class="form-section">
					<h2 class="form-section-title">{m.subscription_personal_title()}</h2>
					<p style="opacity: 0.7; margin-bottom: 1.5rem;">{m.subscription_personal_subtitle()}</p>

					<div class="grid grid-cols-2">
						<div class="form-group">
							<label for="firstName">{m.subscription_first_name()} <span class="required">*</span></label>
							<input
								type="text"
								id="firstName"
								name="firstName"
								value={firstName}
								required
								placeholder={m.subscription_first_name_placeholder()}
								oninput={(e) => firstNameOverride = (e.target as HTMLInputElement).value}
								onblur={(e) => handleFieldBlur('firstName', (e.target as HTMLInputElement).value)}
								class:has-error={getFieldError('firstName')}
							/>
							{#if getFieldError('firstName')}
								<p class="error">{getFieldError('firstName')}</p>
							{/if}
						</div>

						<div class="form-group">
							<label for="lastName">{m.subscription_last_name()} <span class="required">*</span></label>
							<input
								type="text"
								id="lastName"
								name="lastName"
								value={lastName}
								required
								placeholder={m.subscription_last_name_placeholder()}
								oninput={(e) => lastNameOverride = (e.target as HTMLInputElement).value}
								onblur={(e) => handleFieldBlur('lastName', (e.target as HTMLInputElement).value)}
								class:has-error={getFieldError('lastName')}
							/>
							{#if getFieldError('lastName')}
								<p class="error">{getFieldError('lastName')}</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Dati di Nascita -->
				<div class="form-section">
					<h2 class="form-section-title">{m.subscription_birth_title()}</h2>
					<p style="opacity: 0.7; margin-bottom: 1.5rem;">{m.subscription_birth_subtitle()}</p>

					<DatePicker
						name="birthDate"
						label={m.subscription_birth_date()}
						value={birthDate}
						required
						maxDate={new Date()}
						placeholder={m.subscription_birth_date_placeholder()}
						error={getFieldError('birthDate')}
						onchange={(value) => {
							birthDateOverride = value;
						}}
						onblur={(value) => handleFieldBlur('birthDate', value)}
					/>
					{#if m.subscription_birth_date_format_hint()}
						<p class="date-format-hint">{m.subscription_birth_date_format_hint()}</p>
					{/if}

					{#if isUnder16}
						<div class="warning-box">
							<p><strong>{m.subscription_under16_title()}</strong></p>
							<p>{@html m.subscription_under16_text({ email: '<a href="mailto:dopolavoro.milano@gmail.com">dopolavoro.milano@gmail.com</a>' })}</p>
						</div>
					{/if}

					<Listbox
						name="nationality"
						label={m.subscription_nationality()}
						options={[
							{ value: 'IT', label: m.subscription_nationality_italian() },
							{ value: 'XX', label: m.subscription_nationality_foreign() }
						]}
						value={nationality}
						placeholder={m.common_select()}
						required
						disabled={isUnder16}
						error={getFieldError('nationality')}
						onchange={(value) => {
							nationalityOverride = value;
							birthCityOverride = '';
						}}
						onblur={(value) => handleFieldBlur('nationality', value)}
					/>

					{#if isItalian}
						<input type="hidden" name="birthProvince" value={birthProvince} />
						<div class="grid grid-cols-3">
							<div class="form-group col-span-2">
								<AddressAutocomplete
									name="birthCity"
									label={m.subscription_birth_city()}
									mode="city"
									apiKey={data.googlePlacesApiKey}
									value={birthCity}
									error={getFieldError('birthCity')}
									required
									disabled={isUnder16}
									placeholder={m.subscription_birth_city_placeholder()}
									onselect={handleBirthCitySelect}
									onblur={(value) => handleFieldBlur('birthCity', value)}
								/>
							</div>
							<div class="form-group">
								<label for="birthProvinceDisplay">{m.subscription_province()}</label>
								<input
									type="text"
									id="birthProvinceDisplay"
									value={birthProvince}
									disabled
								/>
							</div>
						</div>
					{:else if nationality}
						<input type="hidden" name="birthProvince" value="EE" />
						<AddressAutocomplete
							name="birthCity"
							label={m.subscription_birth_city_foreign()}
							mode="country"
							excludeCountries={['IT']}
							apiKey={data.googlePlacesApiKey}
							value={form?.values?.birthCity || data.profile?.birthCity || ''}
							error={getFieldError('birthCity')}
							required
							disabled={isUnder16}
							placeholder={m.subscription_birth_city_placeholder()}
							onblur={(value) => handleFieldBlur('birthCity', value)}
						/>
					{/if}
				</div>

				<!-- Codice Fiscale -->
				<div class="form-section">
					<h2 class="form-section-title">{m.subscription_tax_title()}</h2>
					<p style="opacity: 0.7; margin-bottom: 1.5rem;">{m.subscription_tax_subtitle()}</p>

					{#if showTaxCodeField}
						<div class="form-group">
							<label for="taxCode">{m.subscription_tax_code()} {#if !isForeigner}<span class="required">*</span>{/if}</label>
							<input
								type="text"
								id="taxCode"
								name="taxCode"
								value={form?.values?.taxCode || data.profile?.taxCode || ''}
								required={!isForeigner}
								disabled={isUnder16}
								placeholder={m.subscription_tax_code_placeholder()}
								maxlength={16}
								onblur={(e) => handleFieldBlur('taxCode', (e.target as HTMLInputElement).value)}
								class:has-error={getFieldError('taxCode')}
							/>
							{#if getFieldError('taxCode')}
								<p class="error">{m.validation_tax_code_invalid()}</p>
							{/if}
						</div>
					{/if}

					{#if isForeigner}
						<div class="checkbox-group">
							<input
								type="checkbox"
								id="hasForeignTaxCode"
								name="hasForeignTaxCode"
								checked={hasForeignTaxCode}
								disabled={isUnder16}
								value="true"
								onchange={(e) => hasForeignTaxCodeOverride = (e.target as HTMLInputElement).checked}
								onblur={(e) => handleCheckboxBlur('hasForeignTaxCode', (e.target as HTMLInputElement).checked)}
							/>
							<label for="hasForeignTaxCode" class="checkbox-label">{m.subscription_has_foreign_tax_code()}</label>
						</div>

						{#if !hasForeignTaxCode}
							<div style="margin-top: 1.5rem;">
								<Listbox
									name="gender"
									label={m.subscription_gender()}
									options={[
										{ value: 'M', label: m.subscription_gender_male() },
										{ value: 'F', label: m.subscription_gender_female() }
									]}
									value={gender}
									placeholder={m.common_select()}
									required
									disabled={isUnder16}
									error={getFieldError('gender')}
									onchange={(value) => genderOverride = value}
									onblur={(value) => handleFieldBlur('gender', value)}
								/>
							</div>
							<input type="hidden" name="taxCode" value="" />
						{/if}
					{/if}
				</div>

				<!-- Contatti -->
				<div class="form-section">
					<h2 class="form-section-title">{m.subscription_contact_title()}</h2>
					<p style="opacity: 0.7; margin-bottom: 1.5rem;">{m.subscription_contact_subtitle()}</p>

					<PhoneInput
						name="phone"
						label={m.subscription_phone()}
						value={form?.values?.phone || data.profile?.phone || ''}
						error={getFieldError('phone')}
						disabled={isUnder16}
						onblur={(value) => handleFieldBlur('phone', value)}
					/>
				</div>

				<!-- Consensi -->
				<div class="form-section">
					<h2 class="form-section-title">{m.subscription_consent_title()}</h2>
					<p style="opacity: 0.7; margin-bottom: 1.5rem;">{m.subscription_consent_subtitle()}</p>

					<div class="info-box" style="margin-bottom: 1.5rem;">
						<p>{m.consent_intro()}</p>
					</div>

					<div class="consent-item">
						<div class="checkbox-group">
							<input
								type="checkbox"
								id="privacyConsent"
								name="privacyConsent"
								checked={form?.values?.privacyConsent || data.profile?.privacyConsent || false}
								required
								disabled={isUnder16}
								value="true"
								onblur={(e) => handleCheckboxBlur('privacyConsent', (e.target as HTMLInputElement).checked)}
								class:has-error={getFieldError('privacyConsent')}
							/>
							<label for="privacyConsent" class="checkbox-label">
								{@html m.consent_privacy_label().replace('Privacy Policy', '<a href="/legal/privacy" target="_blank">Privacy Policy</a>')}
								<span class="required">*</span>
							</label>
						</div>
						{#if getFieldError('privacyConsent')}
							<p class="error">{getFieldError('privacyConsent')}</p>
						{/if}
					</div>

					<div class="consent-item">
						<div class="checkbox-group">
							<input
								type="checkbox"
								id="dataConsent"
								name="dataConsent"
								checked={form?.values?.dataConsent || data.profile?.dataConsent || false}
								required
								disabled={isUnder16}
								value="true"
								onblur={(e) => handleCheckboxBlur('dataConsent', (e.target as HTMLInputElement).checked)}
								class:has-error={getFieldError('dataConsent')}
							/>
							<label for="dataConsent" class="checkbox-label">
								{m.consent_data_label()}
								<span class="required">*</span>
							</label>
						</div>
						{#if getFieldError('dataConsent')}
							<p class="error">{getFieldError('dataConsent')}</p>
						{/if}
					</div>

					<div class="consent-item newsletter-consent">
						<div class="checkbox-group">
							<input
								type="checkbox"
								id="newsletterConsent"
								name="newsletterConsent"
								checked={newsletterConsent}
								disabled={isUnder16}
								value="true"
							/>
							<label for="newsletterConsent" class="checkbox-label">
								{m.consent_newsletter_label()}
								<span class="optional-tag">{m.consent_newsletter_optional()}</span>
							</label>
						</div>
					</div>
				</div>

				<!-- Submit -->
				<button type="submit" disabled={loading || isUnder16}>
					{#if loading}
						{m.subscription_submit_saving()}
					{:else if data.membershipState === SystemState.S4_AWAITING_NUMBER || data.membershipState === SystemState.S5_ACTIVE}
						{m.subscription_submit_save()}
					{:else if data.profileComplete}
						{m.subscription_submit_save()}
					{:else}
						{m.subscription_submit_continue()}
					{/if}
				</button>
			</form>
			{/if}

			<!-- Payment CTA - Show only if profile is complete and payment is possible -->
			{#if data.canProceedToPayment}
				<a href="/membership/checkout" class="payment-cta">
					<button type="button" class="secondary">
						{#if data.membershipState === SystemState.S6_EXPIRED}
							{m.subscription_renew_card()}
						{:else if data.membershipState === SystemState.S3_PAYMENT_FAILED}
							{m.subscription_retry_payment()}
						{:else}
							{m.subscription_proceed_payment()}
						{/if}
					</button>
				</a>
			{/if}
		</TextContainer>
	</div>
</PublicPageLayout>

{#if showSuccessToast}
	<Toast
		message={m.subscription_toast_success()}
		type="success"
		onclose={() => showSuccessToast = false}
	/>
{/if}

{#if showErrorToast}
	<Toast
		message={m.subscription_toast_error()}
		type="error"
		duration={5000}
		onclose={() => showErrorToast = false}
	/>
{/if}

<style>
	@reference "tailwindcss";

	.subscription-page {
		@apply min-h-screen;
	}

	.form-group {
		@apply mb-6;
	}

	.required {
		@apply text-amber-300;
	}

	.has-error {
		@apply border-amber-400;
	}

	.consent-item {
		@apply mb-4;
	}

	/* Newsletter consent styling */
	.newsletter-consent {
		@apply mt-6 pt-6 border-t border-white/20;
	}

	.optional-tag {
		@apply text-sm text-white/50 font-normal ml-2;
	}

	/* Profile Toggle - Improved accordion design */
	.profile-toggle {
		@apply w-full flex items-center gap-4 p-5;
		@apply bg-white/5 border-2 border-white/50 rounded-lg;
		@apply cursor-pointer transition-all duration-200 my-8;
		@apply hover:bg-white/10 hover:border-white/70;
		@apply focus:outline-none;
	}

	.profile-toggle.expanded {
		@apply bg-white/10 border-white;
	}

	.profile-toggle-icon {
		@apply w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0;
		@apply transition-colors duration-200;
	}

	.profile-toggle:hover .profile-toggle-icon {
		@apply bg-white/20;
	}

	.profile-toggle-icon svg {
		@apply w-6 h-6 text-white/80;
	}

	.profile-toggle-content {
		@apply flex-1 flex flex-col items-start gap-0.5 text-left min-w-0;
	}

	.profile-toggle-label {
		@apply text-sm font-medium text-white/60 uppercase tracking-wide;
	}

	.profile-toggle-value {
		@apply text-xl font-semibold text-white truncate w-full;
	}

	.profile-toggle-action {
		@apply flex items-center gap-2 flex-shrink-0;
	}

	.profile-toggle-action-text {
		@apply text-sm font-medium text-white/60 hidden sm:block;
	}

	.profile-toggle:hover .profile-toggle-action-text {
		@apply text-white/80;
	}

	.profile-toggle-chevron {
		@apply w-5 h-5 text-white/60 transition-transform duration-200;
	}

	.profile-toggle:hover .profile-toggle-chevron {
		@apply text-white/80;
	}

	.profile-toggle-chevron.expanded {
		@apply rotate-180;
	}

	.payment-cta {
		@apply block mt-4;
	}

	.payment-cta a {
		@apply no-underline;
	}

	.grid {
		@apply grid gap-4;
	}

	.grid-cols-2 {
		@apply grid-cols-1 md:grid-cols-2;
	}

	.grid-cols-3 {
		@apply grid-cols-1 md:grid-cols-3;
	}

	.col-span-2 {
		@apply md:col-span-2;
	}

	/* Override AddressAutocomplete and PhoneInput styles for dark theme */
	:global(.subscription-page .mb-6) {
		@apply mb-6;
	}

	:global(.subscription-page .label) {
		@apply block text-lg md:text-xl text-white/90 mb-2;
	}

	:global(.subscription-page .input),
	:global(.subscription-page input[type="text"]:not([disabled]):not(.listbox-search)),
	:global(.subscription-page input[type="tel"]:not([disabled])) {
		@apply w-full px-4 text-xl md:text-2xl;
		@apply bg-transparent border-2 border-white/50 rounded-lg;
		@apply text-white placeholder-white/50;
		@apply focus:border-white focus:outline-none focus:ring-0;
		min-height: 68px;
	}

	/* Listbox (custom select) styling */
	:global(.subscription-page .listbox-button) {
		@apply w-full pl-4 pr-10 text-xl md:text-2xl;
		@apply bg-transparent border-2 border-white/50 rounded-lg;
		@apply text-white cursor-pointer;
		@apply focus:border-white focus:outline-none focus:ring-0;
		min-height: 68px;
		display: flex;
		align-items: center;
	}

	:global(.subscription-page .listbox-button span.text-gray-400) {
		@apply text-white/50;
	}

	:global(.subscription-page .listbox-button span.text-gray-900) {
		@apply text-white;
	}

	:global(.subscription-page .listbox-button svg) {
		@apply text-white/70;
	}

	:global(.subscription-page .listbox-dropdown) {
		@apply bg-white border-2 border-gray-200 rounded-lg;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	:global(.subscription-page .listbox-options) {
		@apply list-none m-0 p-0;
	}

	:global(.subscription-page .listbox-search) {
		@apply w-full px-3 py-2 text-sm rounded-md;
		@apply bg-gray-50 border border-gray-200;
		@apply focus:border-orange-400 focus:outline-none focus:ring-0;
		color: #111827 !important;
		min-height: auto !important;
	}

	:global(.subscription-page .listbox-search::placeholder) {
		color: #9ca3af !important;
	}

	/* Search container styling */
	:global(.subscription-page .listbox-dropdown > div:first-child) {
		@apply p-2 bg-gray-50 border-b border-gray-200;
	}

	:global(.subscription-page .listbox-option) {
		@apply text-gray-900;
	}

	:global(.subscription-page .listbox-option:hover),
	:global(.subscription-page .listbox-option.highlighted) {
		@apply bg-orange-50;
	}

	:global(.subscription-page .listbox-option.selected) {
		@apply bg-orange-100 font-medium;
	}

	:global(.subscription-page .listbox-option.selected .text-blue-600) {
		@apply text-orange-600;
	}

	/* Phone prefix dropdown - wider to show full country names */
	:global(.subscription-page .prefix-wrapper .listbox-dropdown) {
		@apply min-w-72;
	}

	:global(.subscription-page .prefix-wrapper .listbox-option span) {
		@apply whitespace-nowrap;
	}

	/* Ensure prefix button text doesn't overlap chevron */
	:global(.subscription-page .prefix-wrapper .listbox-button) {
		@apply pr-8;
	}

	:global(.subscription-page .prefix-wrapper .listbox-button span:first-child) {
		@apply truncate;
	}

	:global(.subscription-page .text-gray-700) {
		@apply text-white/90;
	}

	:global(.subscription-page .text-gray-400) {
		@apply text-white/50;
	}

	:global(.subscription-page .text-red-600) {
		@apply text-amber-300;
	}

	/* Google Places Autocomplete dropdown styling */
	:global(.pac-container) {
		@apply bg-white border-2 border-white/50 rounded-lg mt-1 shadow-xl;
		font-family: inherit;
	}

	:global(.pac-item) {
		@apply px-4 py-3 cursor-pointer border-b border-gray-200;
		@apply text-gray-900 text-base;
	}

	:global(.pac-item:hover),
	:global(.pac-item.pac-item-selected) {
		@apply bg-orange-50;
	}

	:global(.pac-item-query) {
		@apply text-gray-900 font-medium;
	}

	:global(.pac-matched) {
		@apply font-semibold;
	}

	:global(.pac-icon) {
		@apply hidden;
	}

	/* Nominatim dropdown styling for dark theme */
	:global(.subscription-page ul[role="listbox"]) {
		@apply bg-white border-2 border-white/50 rounded-lg shadow-xl;
	}

	:global(.subscription-page ul[role="listbox"] li) {
		@apply border-gray-200;
	}

	/* Date format hint for English users */
	.date-format-hint {
		@apply text-sm text-white/60 mt-1;
	}
</style>
