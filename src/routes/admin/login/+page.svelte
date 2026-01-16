<script lang="ts">
	import { enhance } from '$app/forms';

	type LoginFormData = {
		errors?: {
			email?: string;
			password?: string;
			general?: string;
		};
		email?: string;
	} | null;

	let { form }: { form: LoginFormData } = $props();
	let loading = $state(false);
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
	<div class="w-full max-w-md">
		<!-- Logo/Brand -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-xl mb-4">
				<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
				</svg>
			</div>
			<h1 class="text-2xl font-bold text-white">DopoSpace Admin</h1>
			<p class="text-gray-400 mt-2">Pannello di amministrazione</p>
		</div>

		<!-- Login Card -->
		<div class="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 shadow-2xl">
			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
				class="space-y-6"
			>
				<!-- Email -->
				<div>
					<label for="email" class="block text-sm font-medium text-gray-300 mb-2">
						Email
					</label>
					<input
						type="email"
						id="email"
						name="email"
						value={form?.email || ''}
						required
						class="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
						placeholder="admin@dopo.space"
					/>
					{#if form?.errors?.email}
						<p class="text-red-400 text-sm mt-2">{form.errors.email}</p>
					{/if}
				</div>

				<!-- Password -->
				<div>
					<label for="password" class="block text-sm font-medium text-gray-300 mb-2">
						Password
					</label>
					<input
						type="password"
						id="password"
						name="password"
						required
						class="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
						placeholder="••••••••••"
					/>
					{#if form?.errors?.password}
						<p class="text-red-400 text-sm mt-2">{form.errors.password}</p>
					{/if}
				</div>

				<!-- Error Message -->
				{#if form?.errors?.general}
					<div class="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
						<div class="flex items-center gap-3">
							<svg class="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<p class="text-red-400 text-sm">{form.errors.general}</p>
						</div>
					</div>
				{/if}

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={loading}
					class="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
				>
					{#if loading}
						<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span>Accesso in corso...</span>
					{:else}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
						</svg>
						<span>Accedi</span>
					{/if}
				</button>
			</form>
		</div>

		<!-- Footer -->
		<p class="text-center text-gray-500 text-sm mt-8">
			Area riservata agli amministratori
		</p>
	</div>
</div>
