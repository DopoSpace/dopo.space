<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		subtitleSnippet?: Snippet;
		email?: string;
		showAvatar?: boolean;
		showEmail?: boolean;
	}

	let {
		title,
		subtitle,
		subtitleSnippet,
		email,
		showAvatar = true,
		showEmail = true
	}: Props = $props();

	// Generate initials from email
	function getInitials(email: string): string {
		const name = email.split('@')[0];
		// Take first two characters, capitalize
		return name.slice(0, 2).toUpperCase();
	}
</script>

<div class="welcome-header">
	<div class="welcome-content">
		{#if showAvatar && email}
			<div class="welcome-avatar">
				{getInitials(email)}
			</div>
		{/if}
		<div class="welcome-text">
			<h1 class="welcome-title">{title}</h1>
			{#if subtitleSnippet}
				<p class="welcome-subtitle">{@render subtitleSnippet()}</p>
			{:else if subtitle}
				<p class="welcome-subtitle">{subtitle}</p>
			{/if}
			{#if showEmail && email}
				<div class="welcome-email-badge">
					<svg class="email-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
					</svg>
					<span>{email}</span>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	@reference "tailwindcss";

	.welcome-header {
		@apply mb-6;
	}

	.welcome-content {
		@apply flex items-start gap-4;
	}

	.welcome-avatar {
		@apply w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl font-bold text-white flex-shrink-0;
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.welcome-text {
		@apply flex-1;
	}

	.welcome-title {
		@apply text-3xl md:text-4xl font-bold text-white mb-2;
	}

	.welcome-subtitle {
		@apply text-lg text-white/80 mb-3;
	}

	.welcome-subtitle :global(a) {
		@apply text-white underline underline-offset-2 hover:text-white/90 transition-colors;
	}

	.welcome-email-badge {
		@apply inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-sm text-white/90;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.email-icon {
		@apply w-4 h-4;
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.welcome-content {
			@apply flex-col items-center text-center;
		}

		.welcome-avatar {
			@apply w-14 h-14 text-lg;
		}

		.welcome-title {
			@apply text-2xl;
		}

		.welcome-subtitle {
			@apply text-base;
		}
	}
</style>
