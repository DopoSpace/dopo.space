<script lang="ts">
	import TextContainer from '$lib/components/TextContainer.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="bg-dopoRed min-h-screen flex items-center justify-center px-4">
	<TextContainer>
		{#if data.error}
			<div class="bg-white text-gray-900 rounded-lg p-6 md:p-8">
				<h1 class="text-3xl md:text-4xl font-bold mb-4 text-red-600">Errore</h1>
				<p class="text-lg mb-6">{data.error}</p>
				<a href="/auth/login" class="btn-primary inline-block"> Richiedi nuovo link </a>
			</div>
		{:else}
			<div class="bg-white text-gray-900 rounded-lg p-6 md:p-8 text-center">
				<h1 class="text-3xl md:text-4xl font-bold mb-4">Verifica in corso...</h1>
				<p class="text-lg">Attendere mentre verifichiamo il tuo accesso.</p>
				<div class="mt-6">
					<div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
				</div>
			</div>
		{/if}
	</TextContainer>
</div>
