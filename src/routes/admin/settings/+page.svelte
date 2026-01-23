<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);

	// Format cents to euros for display
	function formatEuros(cents: number): string {
		return (cents / 100).toFixed(2);
	}
</script>

<svelte:head>
	<title>Impostazioni - Admin DopoSpace</title>
</svelte:head>

<div class="settings-page">
	<div class="page-header">
		<h1>Impostazioni</h1>
		<p class="page-subtitle">Gestisci le impostazioni dell'applicazione</p>
	</div>

	<!-- Membership Fee Setting -->
	<div class="settings-card">
		<div class="card-header">
			<div class="card-icon">
				<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<div>
				<h2 class="card-title">Costo Tessera</h2>
				<p class="card-subtitle">Imposta il costo annuale della tessera associativa</p>
			</div>
		</div>

		<form
			method="POST"
			action="?/updateFee"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
			class="card-content"
		>
			{#if form?.success}
				<div class="alert success">
					<svg class="alert-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{form.message}</span>
				</div>
			{/if}

			{#if form?.error}
				<div class="alert error">
					<svg class="alert-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
					</svg>
					<span>{form.error}</span>
				</div>
			{/if}

			<div class="form-group">
				<label for="membershipFee">Costo in Euro</label>
				<div class="input-wrapper">
					<span class="input-prefix">€</span>
					<input
						type="text"
						id="membershipFee"
						name="membershipFee"
						value={form?.value ?? formatEuros(data.membershipFee)}
						placeholder="25.00"
						class="fee-input"
						inputmode="decimal"
					/>
				</div>
				<p class="form-hint">
					Valore attuale: <strong>€{formatEuros(data.membershipFee)}</strong>
				</p>
			</div>

			<div class="form-actions">
				<button type="submit" class="btn-primary" disabled={loading}>
					{#if loading}
						<span class="spinner"></span>
						Salvataggio...
					{:else}
						Salva modifiche
					{/if}
				</button>
			</div>
		</form>
	</div>

	<!-- Info Box -->
	<div class="info-box">
		<svg class="info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
		</svg>
		<div>
			<p><strong>Nota:</strong> La modifica del costo si applica solo ai nuovi pagamenti. Le tessere già pagate mantengono il costo originale.</p>
		</div>
	</div>
</div>

<style>
	.settings-page {
		max-width: 800px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		font-size: 1.875rem;
		font-weight: 700;
		color: #111827;
		margin: 0;
	}

	.page-subtitle {
		color: #6b7280;
		margin-top: 0.25rem;
	}

	.settings-card {
		background: white;
		border-radius: 0.75rem;
		border: 1px solid #e5e7eb;
		overflow: hidden;
		margin-bottom: 1.5rem;
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
	}

	.card-icon {
		width: 2.5rem;
		height: 2.5rem;
		background: #dbeafe;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #2563eb;
	}

	.card-icon svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.card-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
		margin: 0;
	}

	.card-subtitle {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0.125rem 0 0 0;
	}

	.card-content {
		padding: 1.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
	}

	.input-wrapper {
		display: flex;
		align-items: center;
		max-width: 200px;
	}

	.input-prefix {
		padding: 0.625rem 0.75rem;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-right: none;
		border-radius: 0.5rem 0 0 0.5rem;
		color: #6b7280;
		font-weight: 500;
	}

	.fee-input {
		flex: 1;
		padding: 0.625rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0 0.5rem 0.5rem 0;
		font-size: 1rem;
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.fee-input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.form-hint {
		font-size: 0.875rem;
		color: #6b7280;
		margin-top: 0.5rem;
	}

	.form-actions {
		display: flex;
		justify-content: flex-start;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		background: #2563eb;
		color: white;
		font-weight: 500;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-primary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.alert {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.alert.success {
		background: #ecfdf5;
		color: #065f46;
		border: 1px solid #a7f3d0;
	}

	.alert.error {
		background: #fef2f2;
		color: #991b1b;
		border: 1px solid #fecaca;
	}

	.alert-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	.info-box {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 0.5rem;
		color: #1e40af;
		font-size: 0.875rem;
	}

	.info-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.info-box p {
		margin: 0;
	}
</style>
