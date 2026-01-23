<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	interface Props {
		message: string;
		type?: 'success' | 'error' | 'info';
		duration?: number;
		onclose?: () => void;
	}

	let {
		message,
		type = 'success',
		duration = 4000,
		onclose
	}: Props = $props();

	let visible = $state(true);

	onMount(() => {
		const timer = setTimeout(() => {
			visible = false;
			setTimeout(() => onclose?.(), 300); // Wait for exit animation
		}, duration);

		return () => clearTimeout(timer);
	});

	function handleClose() {
		visible = false;
		setTimeout(() => onclose?.(), 300);
	}

	const icons = {
		success: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`,
		error: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />`,
		info: `<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />`
	};

	const styles = {
		success: 'bg-green-50 border-green-200 text-green-800',
		error: 'bg-red-50 border-red-200 text-red-800',
		info: 'bg-blue-50 border-blue-200 text-blue-800'
	};

	const iconColors = {
		success: 'text-green-500',
		error: 'text-red-500',
		info: 'text-blue-500'
	};
</script>

{#if visible}
	<div
		class="toast-container"
		in:fly={{ y: 50, duration: 300 }}
		out:fade={{ duration: 200 }}
	>
		<div class="toast {styles[type]}">
			<svg
				class="toast-icon {iconColors[type]}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				{@html icons[type]}
			</svg>
			<span class="toast-message">{message}</span>
			<button
				type="button"
				class="toast-close"
				onclick={handleClose}
				aria-label="Chiudi notifica"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	@reference "tailwindcss";

	.toast-container {
		@apply fixed bottom-6 right-6 z-50;
	}

	.toast {
		@apply flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-sm;
		animation: toast-progress linear forwards;
		animation-duration: var(--toast-duration, 4s);
	}

	.toast-icon {
		@apply w-5 h-5 flex-shrink-0;
	}

	.toast-message {
		@apply text-sm font-medium flex-1;
	}

	.toast-close {
		@apply p-1 rounded hover:bg-black/5 transition-colors flex-shrink-0 -mr-1;
	}

	@keyframes toast-progress {
		from {
			background-position: 0% 100%;
		}
		to {
			background-position: 100% 100%;
		}
	}
</style>
